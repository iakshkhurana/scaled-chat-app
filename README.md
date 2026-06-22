<div align="center">

# RELAY

### Realtime chat for teams — public rooms & direct messages, delivered the instant they're sent.

<a href="https://ibb.co/fscqFX6"><img src="https://i.ibb.co/NM4tCFD/Screenshot-2026-06-22-132948.png" alt="RELAY screenshot" border="0" width="850"></a>

<br/>

![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-ws-010101?logo=socketdotio&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)

</div>

---

## ✨ What is RELAY?

RELAY is a full-stack realtime chat application. You sign up, create **public rooms** or start
**direct messages**, and every message is delivered live over a WebSocket — no refreshing, no polling.
Chat history is stored permanently in PostgreSQL, while Redis fans out live messages so the system
can scale across multiple servers.

It is built as a small set of focused services so each part is easy to understand and reason about.

### Features

- 🔐 **Auth** — register & login with hashed passwords (bcrypt) and JWT sessions
- 💬 **Public rooms** — create a channel, anyone can join, full history is kept
- 📨 **Direct messages** — private 1:1 conversations (a DM is just a 2-member room)
- ⚡ **Realtime delivery** — messages pushed live over WebSockets
- 🔁 **Horizontal scaling** — Redis pub/sub fans messages out across ws-service instances
- 🔔 **Notifications** — in-app toast + desktop notification when you get a message
- 🎨 **Polished UI** — React + Tailwind, with a landing page and in-app docs

---

## 🏗️ Architecture

RELAY is split into **four parts** that share one database and one JWT secret.

```
                    ┌─────────────────────────────┐
                    │         BROWSER (client)     │
                    │   React + Vite + Tailwind    │
                    │            :5173             │
                    └──────┬───────────────┬───────┘
                           │ REST (HTTP)   │ WebSocket (live)
                           ▼               ▼
                 ┌──────────────┐   ┌──────────────┐
                 │ api-service  │   │  ws-service  │
                 │   Express    │   │     ws       │
                 │   :4000      │   │    :5050     │
                 │ auth, rooms, │   │ live messages│
                 │ history      │   │ join / send  │
                 └──────┬───────┘   └───┬──────┬───┘
                        │               │      │ publish / subscribe
                        ▼               ▼      ▼
                 ┌──────────────┐       ┌──────────────┐
                 │  PostgreSQL  │       │    Redis     │
                 │    :5432     │       │    :6379     │
                 │ users, rooms,│       │  message     │
                 │ messages     │       │  fan-out     │
                 └──────────────┘       └──────────────┘
```

**Why two backends?** REST and WebSockets have different natures:

| | **api-service** (REST) | **ws-service** (WebSocket) |
|---|---|---|
| Protocol | HTTP request → response | Long-lived WebSocket |
| Handles | login, room list, history | live message delivery |
| State | stateless | holds open connections |

They never call each other directly — they coordinate through **shared Postgres + Redis**, and both
trust the **same `JWT_SECRET`** (api-service signs the token, ws-service verifies it).

> 📖 Deep dive: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

---

## 🧰 Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4 |
| REST API | Node.js, Express 5, bcrypt, jsonwebtoken |
| Realtime | `ws` (WebSocket), Redis pub/sub |
| Database | PostgreSQL 16 (`pg`) |
| Infra | Docker Compose (Postgres + Redis) |
| Dev runtime | `tsx` (run TypeScript directly, no build step) |

---

## 📁 Project structure

```
chat-app/
├── client/            # React + Vite + Tailwind frontend
│   └── src/
│       ├── components/ # AuthScreen, ChatApp, Sidebar, RoomView, Landing, DocsPage, ...
│       └── lib/        # api.ts (REST), useSocket.ts (WebSocket), auth.ts, notify.ts
├── api-service/       # Express REST API (auth, rooms, history)
│   ├── routes/        # auth, rooms, dms, me, users
│   └── middleware/    # requireAuth (JWT verification)
├── ws-service/        # WebSocket server (live messages + Redis fan-out)
├── shared/            # Postgres connection pool (db.ts) + schema.sql
├── docs/              # 📚 detailed, beginner-friendly guides (read these!)
└── docker-compose.yml # Postgres + Redis
```

> **Note:** each service has its **own** `package.json` and `node_modules` (no root install).
> Dependencies are not hoisted — install inside each folder.

---

## 🚀 Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Docker](https://www.docker.com/) (for Postgres + Redis)

### 1. Clone

```bash
git clone <your-repo-url>
cd chat-app
```

### 2. Start the database & cache

```bash
docker compose up -d
```

This starts PostgreSQL on `:5432` and Redis on `:6379`.

### 3. Load the database schema

```bash
docker compose exec -T postgres psql -U chat -d chatdb < shared/schema.sql
```

### 4. Create the `.env` files

<details>
<summary><b>api-service/.env</b></summary>

```env
DATABASE_URL=postgresql://chat:chatpass@localhost:5432/chatdb
JWT_SECRET=change-me-to-a-long-random-string
PORT=4000
```
</details>

<details>
<summary><b>ws-service/.env</b></summary>

```env
DATABASE_URL=postgresql://chat:chatpass@localhost:5432/chatdb
JWT_SECRET=change-me-to-a-long-random-string
REDIS_URL=redis://localhost:6379
PORT=5050
```
</details>

<details>
<summary><b>client/.env</b></summary>

```env
VITE_API_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:5050
```
</details>

> ⚠️ **`JWT_SECRET` must be identical in `api-service` and `ws-service`** — one signs the login
> token, the other verifies it. Different secrets = "invalid token".

### 5. Install dependencies (each service separately)

```bash
cd shared      && npm install && cd ..
cd api-service && npm install && cd ..
cd ws-service  && npm install && cd ..
cd client      && npm install && cd ..
```

### 6. Run everything (one terminal each)

```bash
cd api-service && npm run dev    # http://localhost:4000
cd ws-service  && npm run dev    # ws://localhost:5050
cd client      && npm run dev    # http://localhost:5173
```

Open **http://localhost:5173**, register an account, and start chatting.
To see realtime in action, open a second browser (or an incognito window), register a different
user, and message between them.

> 🪟 **Windows users:** run Node on Windows directly (PowerShell / Git Bash), not inside WSL.

---

## 🔌 REST API

Base URL: `http://localhost:4000`. Every route except auth requires the header
`Authorization: Bearer <token>`.

| Method | Path | Auth | Description |
|---|---|:---:|---|
| `POST` | `/auth/register` | — | Create a user, returns a JWT |
| `POST` | `/auth/login` | — | Log in, returns a JWT |
| `GET`  | `/rooms` | ✅ | List public rooms |
| `POST` | `/rooms` | ✅ | Create a public room |
| `GET`  | `/rooms/:id/messages` | ✅ | Paginated history (`?before=<id>`) |
| `POST` | `/dms/:userId` | ✅ | Find or create a DM with another user |
| `GET`  | `/me/rooms` | ✅ | Rooms I belong to (public + DM) |
| `GET`  | `/users` | ✅ | Everyone except me (to start a DM) |

> 📖 Line-by-line walkthrough: [`docs/API-SERVICE.md`](docs/API-SERVICE.md)

---

## ⚡ WebSocket protocol

Connect with the JWT in the query string (browsers can't set WebSocket headers):

```
ws://localhost:5050?token=<jwt>
```

**Client → server**

| `type` | fields | meaning |
|---|---|---|
| `join` | `roomId` | subscribe to a room's live messages |
| `message` | `roomId`, `body` | send a message |
| `leave` | `roomId` | stop receiving that room |

**Server → client**

| `type` | payload | meaning |
|---|---|---|
| `ready` | `user` | connected & authenticated |
| `joined` | `roomId` | join confirmed |
| `message` | `message` | a new message arrived |
| `error` | `error` | something went wrong |

> 📖 How realtime + Redis works: [`docs/WS-SERVICE.md`](docs/WS-SERVICE.md)

---

## 🗄️ Database schema

```
users         (id, email, username, password_hash, created_at)
rooms         (id, name, type['public'|'dm'], created_at)
room_members  (room_id, user_id)              -- who can access which room
messages      (id, room_id, sender_id, body, created_at)
```

A **DM is just a room** with `type='dm'` and exactly two members — so the messaging logic is
identical for rooms and DMs. See [`shared/schema.sql`](shared/schema.sql).

---

## 🔄 How it works: the life of a message

1. You type and hit send — the client sends `{type:"message", roomId, body}` over the **WebSocket**.
2. **ws-service** verifies your JWT, checks membership, and **saves the message to Postgres** (durable).
3. ws-service **publishes** the message to a Redis channel `room:<id>`.
4. **Every** ws-service instance subscribed to that channel receives it and **pushes** it to its
   connected clients in that room.
5. Everyone in the room sees it instantly. Later, reopening the room loads past messages from
   Postgres via the REST API.

**Postgres = the permanent record. Redis = live delivery. WebSocket = the pipe to the browser.**

---

## 📚 Documentation

This repo is heavily documented so you can read the code and understand *why*, not just *what*:

| Doc | What it covers |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | The big picture, why each tech exists, why the split |
| [`docs/API-SERVICE.md`](docs/API-SERVICE.md) | REST API explained (auth, JWT, routes, middleware) |
| [`docs/WS-SERVICE.md`](docs/WS-SERVICE.md) | WebSockets + Redis pub/sub, step by step |
| [`docs/CLIENT.md`](docs/CLIENT.md) | The React frontend, state, and design system |
| [`docs/DB-CONNECTION.md`](docs/DB-CONNECTION.md) | The Postgres connection pool |

---

## 📜 Scripts (per service)

| Command | Does |
|---|---|
| `npm run dev` | Run in watch mode (`tsx watch` / `vite`) |
| `npm run build` | Type-check & build for production |

---

<div align="center">
Built with ❤️ as a learning project. PRs and questions welcome.
</div>
