# Architecture & Responsibilities

This doc explains **what each technology does**, **why it's there**, and **why each
responsibility lives in api-service vs ws-service**. Read it next to
[`PROJECT_IMPLEMENTATION.md`](./PROJECT_IMPLEMENTATION.md).

---

## The big picture

```
        ┌──────────┐   REST/HTTP   ┌──────────────┐
        │          ├──────────────►│ api-service  ├──► Postgres  (write users, read history)
        │  React   │               └──────────────┘      ▲
        │  client  │   WebSocket   ┌──────────────┐      │ (write messages, read membership)
        │          ├──────────────►│  ws-service  ├──────┘
        └──────────┘               └──────┬───────┘
                                          │ PUBLISH / SUBSCRIBE
                                          ▼
                                     ┌──────────┐
                                     │  Redis   │  pub-sub bus + presence store
                                     └──────────┘
```

Four moving parts, each with a distinct job. The rest of this doc takes them one at a time.

---

## What does PostgreSQL do?

**Role: the source of truth. Durable, queryable, permanent.**

Postgres stores everything that must *survive a restart* and that you need to *query*:

- **Users** — accounts, hashed passwords, usernames. Must persist forever.
- **Rooms** — public channels and DM rooms.
- **Memberships** — who is allowed in which room (authorization).
- **Messages** — the full chat history.

Why a relational DB specifically?
- Chat data is **relational**: a message *belongs to* a room and *was sent by* a user;
  a user *is a member of* many rooms. Foreign keys enforce this integrity.
- You need **rich queries**: "last 50 messages in room 12, oldest-first", "all rooms
  user 3 belongs to", "does a DM between A and B already exist". SQL + indexes handle
  these efficiently.
- It's the **durable record**. If every server crashes, the conversation history is
  still safe in Postgres.

**Postgres is NOT used for real-time delivery.** Reading from a DB on every message for
every recipient would be slow and wouldn't notify anyone. Delivery is Redis's job.

---

## What does Redis do?

Redis plays **two separate roles** here. Keep them mentally distinct.

### Role 1 — Pub-Sub: the real-time message bus

This is the heart of why the app scales.

**The problem it solves:** a WebSocket connection lives inside *one* Node process's
memory. If you run two ws-service instances (which you will, for scale/redundancy),
a user on instance A's socket is invisible to instance B. So if B receives a message
for a room that has members on A, B has no way to reach them directly.

**The fix:** instead of broadcasting a message straight to local sockets, a ws instance
`PUBLISH`es it to a Redis channel (e.g. `room:12`). *Every* ws instance is `SUBSCRIBE`d
to that channel, receives the message, and forwards it to its *own* local sockets in
that room.

```
user X (on ws-A) sends msg ──► ws-A persists to Postgres
                                 └─► PUBLISH room:12 ──► Redis
                                                          │
                            ┌─────────────────────────────┼─────────────────────────────┐
                            ▼                             ▼                              ▼
                          ws-A                          ws-B                           ws-C
                     fan out to its            fan out to its                  (no members,
                     room:12 sockets           room:12 sockets                 ignores it)
```

Properties of pub-sub that matter:
- **Fire-and-forget.** Redis does not store published messages. If no one is
  subscribed, the message is gone. That's fine — durability is Postgres's job; Redis
  only handles *live relay*.
- **Decoupled.** Publishers don't know how many subscribers exist. Add a 4th ws
  instance and it just works.

### Role 2 — Presence (and other ephemeral state)

Redis is also a fast in-memory key-value store, perfect for data that is short-lived
and changes constantly:

- **Online presence:** `SET presence:<userId> "online" EX 30` (a key with a TTL).
  The client/ws refreshes it periodically; if the user drops, the key expires
  automatically. Other users query/subscribe to know who's online.
- **Typing indicators, rate-limit counters, etc.** — all transient, none worth a
  Postgres write.

Why Redis and not Postgres for this? It's **in-memory (microsecond reads/writes)**,
has **built-in TTL/expiry**, and this data is **disposable** — losing it on a Redis
restart costs nothing. Writing presence churn to Postgres would hammer the disk for
data you don't even keep.

**Summary:** Postgres = permanent + queryable. Redis = fast + ephemeral + a message bus.

---

## What does Kafka do? (a LATER scaling addition — not in the core build)

> Kafka is **Step 11** — added only after the Redis-based app works. It does **not
> replace Redis pub-sub.** They coexist: Redis stays the real-time path; Kafka becomes
> the durable backbone for async work.

**Role: a durable, replayable event log that decouples producers from many consumers.**

### Kafka vs Redis pub-sub — different tools

| | **Redis pub-sub** | **Kafka** |
|---|---|---|
| Model | Fire-and-forget broadcast | Durable, append-only log |
| If a consumer is offline | Message **lost** | Message **retained** — replay later |
| Latency | Microseconds (ideal for live push) | Milliseconds+ (higher) |
| Ordering / replay | No | Yes, per partition |
| Built for | **Live delivery** to connected users | **Durable pipeline** to async consumers |

Because of the latency and fire-and-forget nature, Redis is right for *pushing to
online sockets*. Kafka is right for *guaranteeing downstream consumers see every event*.

### Why add it — what it buys you

The target architecture once Kafka is in:
```
                      ┌─► Redis pub-sub ─► live fan-out to ONLINE sockets (unchanged)
ws-service ─ message ─┤
                      └─► Kafka topic "messages" ─┬─► persist-worker      → Postgres
                                                  ├─► notification-worker → OFFLINE users
                                                  └─► (search, analytics, moderation…)
```

Concrete wins:
- **Decouples the hot path from Postgres.** ws-service stops writing to the DB; it just
  produces to Kafka and moves on. A separate persist-worker consumes and writes. Write
  spikes are absorbed by the log instead of blocking message delivery.
- **No missed events.** If a worker crashes, the events sit in the log; on restart it
  resumes from its **offset** and catches up. Redis pub-sub can't do this.
- **Add consumers without touching producers.** Want search indexing or analytics?
  Spin up a new consumer group — ws-service doesn't change.

### Core Kafka concepts

- **Topic** — a named, durable, append-only log (e.g. `messages`).
- **Partition** — an ordered shard of a topic. Partition by `roomId` so each room's
  messages stay ordered.
- **Consumer group** — consumers sharing the work of a topic. *Different* groups each
  receive the **full** stream independently — that's how persist + notifications both
  see every message.
- **Offset** — each group's bookmark into the log, enabling restart/replay (the
  durability Redis lacks).

### Why NOT in the core build

It adds broker ops (KRaft/partitions/consumer groups) and a couple of worker services
before any messages even flow. Until you have an async consumer that *must not miss
events* (offline notifications, search, analytics) or you specifically want to move
Postgres writes off the hot path, Redis pub-sub alone already gives you horizontal
scaling across ws instances. Add Kafka when you feel that specific pain — not before.

---

## What does the WebSocket do?

**Role: the persistent, two-way, real-time pipe between browser and server.**

Plain HTTP is request→response: the client asks, the server answers, the connection
ends. The server can't *push* anything unprompted. Chat needs the opposite — the server
must push a new message to you the instant someone sends it, without you asking.

A **WebSocket** is a long-lived connection that stays open and lets data flow **both
directions** at any time. That's exactly what real-time chat needs. ws-service holds
one (or more) open WebSocket per logged-in user and pushes messages down it as they arrive.

---

## Why two services? (api vs ws)

They're split because they have **fundamentally different natures**:

| | **api-service** (Express) | **ws-service** (`ws`) |
|---|---|---|
| Protocol | HTTP / REST | WebSocket |
| Statefulness | **Stateless** — any instance can serve any request | **Stateful** — holds live socket connections in memory |
| Scaling trigger | Request throughput | Number of concurrent connections |
| Restart impact | ~Zero (client just retries) | Drops sockets (clients must reconnect) |
| Typical work | CPU-light, DB-bound request/response | Long-lived connections, constant small pushes |

Mixing them in one process means a deploy/restart of your REST code also kills every
live chat socket. Splitting lets you scale and deploy them independently. This is the
classic **stateless-vs-stateful** service boundary.

---

## Why is each responsibility in api or ws?

The guiding rule: **does it need a live connection, or is it a one-shot request?**

### Lives in api-service (REST, stateless)

| Responsibility | Why here |
|---|---|
| **Register / login** | One-shot request/response. No live connection needed. Issues the JWT. |
| **List / create rooms** | Simple CRUD; happens occasionally, not per-message. |
| **Load message history** | A paginated *read*. Client asks once when opening a room. Pull, not push. |
| **Find-or-create a DM** | One-shot setup action before the real-time chat begins. |
| **List my rooms** | A read on page load. |

These are all "ask once, get an answer." HTTP is the natural fit, and keeping them
stateless means you can scale api-service freely behind a load balancer.

### Lives in ws-service (WebSocket, stateful)

| Responsibility | Why here |
|---|---|
| **Holding live connections** | The whole point of WebSocket — the open pipe to each user. |
| **Sending a message** | Arrives over the socket; must be pushed to others instantly. |
| **Writing messages to Postgres** | ws-service already has the message in hand — making it the single writer keeps the path simple (one writer, no coordination). |
| **Publishing to Redis pub-sub** | Real-time fan-out across instances — inherently a live-delivery concern. |
| **Presence & typing** | Tied to the connection lifecycle (connect = online, disconnect = offline). |

These all involve a *live connection* or *instant push*. They can't be done over plain
request/response HTTP.

### The two shared contracts (how the split stays coherent)

Because the services don't call each other directly, two shared things keep them in sync:

1. **The same `JWT_SECRET`.** api-service *issues* a signed token at login; ws-service
   *verifies* that token when a socket connects. The token itself is the proof of
   identity — no service-to-service auth call required.
2. **Shared Redis + Postgres.** They coordinate through the data layer: ws writes
   messages and publishes; api reads history. Redis carries live events between
   instances and services.

---

## Why one `rooms` table for both public rooms and DMs?

A **DM is just a private room with exactly two members** (`type='dm'`). By modeling it
this way:
- **Messaging logic is identical** for rooms and DMs — same `messages` table, same
  send/persist/publish/fan-out path. No duplicated code.
- Only **creation** and **discovery** differ: a public room is created openly and
  listed for everyone; a DM is created on demand between two users and only shown to them.

This is a deliberate simplification that pays off in every later step.

---

## End-to-end: the life of a message

1. User types in React, hits send.
2. Client sends `{type:"message", roomId, body}` over the **WebSocket** to ws-service.
3. ws-service **verifies membership** (Postgres `room_members`) and **inserts** the
   message (Postgres `messages`) — now it's durable.
4. ws-service **`PUBLISH`es** the message to Redis channel `room:<id>`.
5. **Every** ws-service instance subscribed to `room:<id>` receives it.
6. Each instance **forwards** the message down the WebSockets of its locally-connected
   members of that room.
7. Recipients' React apps receive the `message` event and render it live.
8. Later, anyone opening the room loads past messages via **api-service**
   `GET /rooms/:id/messages` (a Postgres read).

Notice the clean division: **Postgres for the permanent record, Redis for live
delivery, WebSocket for the browser pipe, api for one-shot reads, ws for real-time.**
