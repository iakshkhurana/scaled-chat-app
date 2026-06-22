# Chat App — Step-by-Step Implementation Guide

A real-time chat app with **public rooms** and **private 1:1 DMs**, built as a
small **microservices** system.

**Stack:** React (client) · Node + Express (api-service) · Node + `ws` (ws-service) ·
Redis (pub-sub + presence) · PostgreSQL (persistence) · Docker Compose (local infra).

> Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) alongside this — it explains *why*
> each technology exists and why each responsibility lives in api vs ws.

---

## Final project structure (target)

```
chat-app/
├── docker-compose.yml      # Redis + Postgres (and later, the two services)
├── docs/
│   ├── PROJECT_IMPLEMENTATION.md
│   └── ARCHITECTURE.md
├── client/                 # React (Vite)
├── api-service/            # Express REST: auth + reads (history, room list)
├── ws-service/             # ws: realtime send/receive, writes messages
└── shared/                 # shared helpers: JWT verify, DB pool, channel names
```

**Key decisions (locked in):**
- Two backend services: **api-service** (REST/stateless) and **ws-service** (WebSocket/stateful).
- **ws-service writes messages** to Postgres; **api-service only reads** history.
- Both services share the **same `JWT_SECRET`**: api issues tokens, ws verifies them.
- Live message fan-out happens over **Redis pub-sub**; durable storage is **Postgres**.

---

## Step 1 — Skeleton + Docker Compose

**Goal:** folder structure + Redis and Postgres running in containers.

1. Verify Docker:
   ```powershell
   docker --version
   docker compose version
   ```
2. Create folders: `client/`, `api-service/`, `ws-service/`, `shared/`, `docs/`.
3. Create `docker-compose.yml` in the project root:
   ```yaml
   services:
     postgres:
       image: postgres:16
       restart: unless-stopped
       environment:
         POSTGRES_USER: chat
         POSTGRES_PASSWORD: chatpass
         POSTGRES_DB: chatdb
       ports:
         - "5432:5432"
       volumes:
         - pgdata:/var/lib/postgresql/data

     redis:
       image: redis:7
       restart: unless-stopped
       ports:
         - "6379:6379"

   volumes:
     pgdata:
   ```
4. Start and verify:
   ```powershell
   docker compose up -d
   docker compose ps
   ```
   Both `postgres` and `redis` should be `running`/`healthy`.

**Done when:** `docker compose ps` shows both containers up.

---

## Step 2 — Database schema

**Goal:** tables for users, rooms, memberships, and messages that support *both*
public rooms and private DMs.

Core tables:

| Table | Purpose |
|-------|---------|
| `users` | account: id, email (unique), password_hash, username, created_at |
| `rooms` | a chat space: id, name, type (`'public'` \| `'dm'`), created_at |
| `room_members` | who belongs to a room: room_id, user_id (composite PK) |
| `messages` | id, room_id, sender_id, body, created_at |

**Why one `rooms` table for both?** A DM is just a room with `type='dm'` and exactly
two members. This keeps messaging logic identical for rooms and DMs — only creation
and discovery differ. (Details in [`ARCHITECTURE.md`](./ARCHITECTURE.md).)

Suggested SQL (put in `shared/schema.sql`):
```sql
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rooms (
  id         SERIAL PRIMARY KEY,
  name       TEXT,
  type       TEXT NOT NULL CHECK (type IN ('public','dm')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE room_members (
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE messages (
  id         BIGSERIAL PRIMARY KEY,
  room_id    INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id  INTEGER NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- speeds up "load latest messages in a room"
CREATE INDEX idx_messages_room_created ON messages (room_id, created_at DESC);
```

Apply it:
```powershell
docker compose exec -T postgres psql -U chat -d chatdb < shared/schema.sql
```

**Done when:** `\dt` inside `psql` lists all four tables.

---

## Step 3 — api-service: auth (REST)

**Goal:** register and login endpoints that issue a JWT.

1. `cd api-service && npm init -y`
2. Install: `express`, `pg`, `bcrypt`, `jsonwebtoken`, `cors`, `dotenv`.
3. `.env`: `DATABASE_URL`, `JWT_SECRET`, `PORT=4000`.
4. Build a Postgres pool (reusable connection) — put it in `shared/db.js`.
5. Endpoints:
   - `POST /auth/register` → validate, `bcrypt.hash` password, insert user, return JWT.
   - `POST /auth/login` → look up by email, `bcrypt.compare`, return JWT.
   - JWT payload: `{ userId, username }`. Sign with `JWT_SECRET`, ~7-day expiry.
6. Add auth middleware: read `Authorization: Bearer <token>`, `jwt.verify`, attach `req.user`.

**Done when:** you can register + login with `curl`/Postman and get back a token.

---

## Step 4 — api-service: data endpoints (reads)

**Goal:** the REST endpoints the client needs that aren't realtime.

All require the auth middleware:
- `GET /rooms` → list public rooms.
- `POST /rooms` → create a public room.
- `GET /rooms/:id/messages?before=<cursor>` → paginated history (uses the index from Step 2).
- `POST /dms/:userId` → find-or-create a DM room between `req.user` and `:userId`, return room id.
- `GET /me/rooms` → rooms (public + DM) the current user belongs to.

**Done when:** you can create a room and fetch its (empty) history with your token.

---

## Step 5 — ws-service: connections + auth

**Goal:** a WebSocket server that only accepts authenticated sockets.

1. `cd ws-service && npm init -y`
2. Install: `ws`, `pg`, `jsonwebtoken`, `redis`, `dotenv`.
3. Same `JWT_SECRET` and `DATABASE_URL` in `.env`; `PORT=4001`.
4. Create a `ws` server. On connection, expect the token (query param
   `?token=...` or a first `auth` message). `jwt.verify` it — reject if invalid.
5. Track connections in memory: `Map<userId, Set<WebSocket>>` (a user can have
   multiple tabs).

**Done when:** a `wscat` client with a valid token connects; an invalid one is rejected.

---

## Step 6 — Messaging on a single ws instance

**Goal:** join a room, send a message, everyone in the room (on *this* instance) sees it.

Define a small message protocol (JSON), e.g.:
```jsonc
// client → server
{ "type": "join",    "roomId": 12 }
{ "type": "message", "roomId": 12, "body": "hello" }
// server → client
{ "type": "message", "roomId": 12, "senderId": 3, "username": "ana", "body": "hello", "createdAt": "..." }
```

On `message`:
1. Check the sender is a member of the room (query `room_members`).
2. **Write to Postgres** (`INSERT INTO messages ...`).
3. Broadcast to all local sockets of users in that room.

**Done when:** two browser tabs in the same room see each other's messages, and
messages survive a refresh (loaded via Step 4 history endpoint).

---

## Step 7 — Redis pub-sub (multi-instance fan-out)

**Goal:** messages work even when users are connected to *different* ws-service instances.

The problem: sockets live in one process's memory. Two ws instances can't see each
other's sockets. Redis pub-sub is the bridge.

1. Create **two** Redis clients in ws-service: one `publisher`, one `subscriber`
   (a subscribed connection can't run other commands — that's why two).
2. On startup, `subscriber.subscribe('room:<id>')` for rooms with local members
   (or subscribe to one global `chat` channel for simplicity first).
3. On a new message: after writing to Postgres, **`publisher.publish('room:<id>', payload)`**
   instead of broadcasting directly.
4. In the subscriber's message handler: parse payload, broadcast to local sockets
   of that room.

So the flow becomes: receive → persist → publish → (all instances) receive → fan out locally.

**Done when:** run two ws-service instances on different ports; a message from a
client on instance A reaches a client on instance B.

---

## Step 8 — Private DMs

**Goal:** 1:1 conversations.

Mostly reuses everything:
1. `POST /dms/:userId` (Step 4) creates a `type='dm'` room with the two users as members.
2. Messaging is identical — same `message` protocol, same persist + publish path.
3. The only special logic: "find existing DM between A and B" before creating a new one
   (so you don't make duplicate DM rooms).

**Done when:** two users can open a DM and exchange messages that others can't see.

---

## Step 9 — React client

**Goal:** the UI tying it together.

1. `npm create vite@latest client -- --template react`
2. Install: `axios` (REST), and use the native `WebSocket` API (or a small wrapper).
3. Screens:
   - **Auth** — register/login form; store JWT (memory or `localStorage`).
   - **Sidebar** — list of public rooms + DMs (`GET /me/rooms`, `GET /rooms`).
   - **Chat view** — load history (`GET /rooms/:id/messages`), open WebSocket, render
     incoming `message` events live, send on submit.
4. On login: connect the WebSocket with the token. On room open: send `join`.

**Done when:** full loop works in the browser across two accounts.

---

## Step 10 — Presence & polish

**Goal:** the touches that make it feel real.

- **Online presence:** on connect, `SET presence:<userId>` in Redis with a TTL;
  refresh periodically; on disconnect, delete. Publish presence changes so others update.
- **Typing indicators:** ephemeral `typing` messages over WebSocket (never persisted).
- **History pagination:** "load older" using the `before` cursor.
- **Reconnect logic** on the client (WebSockets drop; auto-reconnect + re-join rooms).

**Done when:** you can see who's online, typing shows up, and a dropped connection recovers.

---

## Step 11 — Kafka event backbone (LATER — do not start until 1–10 work)

> **Only attempt this after the Redis-based app is fully working.** Kafka does **not**
> replace Redis pub-sub — Redis stays the real-time delivery path. Kafka is the
> **durable event backbone** for async consumers. See the Kafka section in
> [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the why.

**Goal:** decouple the hot path from Postgres and enable downstream consumers
(persistence, notifications, search, analytics) that must never miss an event.

The target flow:
```
ws-service ──► Kafka topic "messages" ──┬─► persist-worker      → Postgres
                                        ├─► notification-worker → offline users
                                        └─► (future: search, analytics, moderation)

ws-service ──► Redis pub-sub  (UNCHANGED — still the live fan-out to online sockets)
```

1. **Add Kafka to `docker-compose.yml`** (use a KRaft-mode image — no Zookeeper needed):
   ```yaml
   kafka:
     image: bitnami/kafka:3.7
     restart: unless-stopped
     ports:
       - "9092:9092"
     environment:
       KAFKA_CFG_NODE_ID: "0"
       KAFKA_CFG_PROCESS_ROLES: "controller,broker"
       KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: "0@kafka:9093"
       KAFKA_CFG_LISTENERS: "PLAINTEXT://:9092,CONTROLLER://:9093"
       KAFKA_CFG_ADVERTISED_LISTENERS: "PLAINTEXT://localhost:9092"
       KAFKA_CFG_CONTROLLER_LISTENER_NAMES: "CONTROLLER"
       ALLOW_PLAINTEXT_LISTENER: "yes"
   ```
2. **Create a topic** `messages` (partition by `roomId` so a room's messages stay
   ordered): `kafka-topics.sh --create --topic messages --partitions 6`.
3. **In ws-service**, install a client (`kafkajs`). On a new message, change the order:
   - `publish` to **Redis** for instant live delivery (as before), **and**
   - `produce` the event to the Kafka `messages` topic (key = `roomId`).
   - **Stop writing to Postgres directly here** — the persist-worker now owns that.
4. **Create `persist-worker/`** — a new tiny service that consumes the `messages`
   topic (consumer group `persist`) and does the `INSERT INTO messages`. This is the
   write decoupling: ws no longer blocks on the DB.
5. **(Optional) `notification-worker/`** — consumes the same topic (a *different*
   consumer group, so it gets its own copy), checks Redis presence, and notifies
   users who are offline.

**Key Kafka concepts you'll learn here:**
- **Topic** = named durable log. **Partition** = ordered shard of it (same `roomId`
  → same partition → ordered).
- **Consumer group** = a set of consumers sharing the work of a topic. Different
  groups each get the *full* stream — that's how persist + notifications both see
  every message independently.
- **Offsets** = each group's bookmark; a worker can restart and resume where it left
  off (this is the replay/durability Redis pub-sub can't give you).

**Done when:** killing the persist-worker, sending messages (still delivered live via
Redis), then restarting the worker — and seeing the missed messages get written to
Postgres from the Kafka log.

---

## Suggested build order recap

Infra (1) → schema (2) → auth (3) → REST reads (4) → ws connect (5) →
single-instance messaging (6) → Redis fan-out (7) → DMs (8) → client (9) → polish (10).

Then, **only once that all works**, the scaling milestone: Kafka backbone (11).

Each step is independently testable. Don't move on until the "Done when" passes.
