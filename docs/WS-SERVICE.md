# ws-service — realtime chat ka dil (beginner guide)

`api-service` REST tha (request bhejo, jawab lo, connection band). Chat realtime
chahiye — bina refresh ke message turant dikhe. Iske liye **WebSocket** use karte hain,
aur multiple servers ke beech message bhejne ke liye **Redis pub/sub**.

---

## 1. WebSocket vs REST (pehle yeh samjho)

**REST (api-service):** har baar nayi call. "Naye message aaye?" baar-baar poochhna padega
(polling) — slow aur wasteful.

**WebSocket:** ek baar connection khulta hai aur **khula rehta hai**. Dono taraf se
kabhi bhi message bhej sakte ho. Server ke paas naya message aaya -> turant push kar deta hai.
Yahi realtime chat ke liye perfect hai.

```
REST:       client --req-->  server   (jawab ke baad connection band)
            client --req-->  server   (dubara poora connection)

WebSocket:  client <=======> server   (ek hi connection, khula rehta hai,
                                        dono kabhi bhi bol sakte hain)
```

---

## 2. Bada picture

```
ws-service/
  index.ts    <- main: WS server, connection handle, join/message logic
  redis.ts    <- publisher + subscriber (pub/sub setup)
  rooms.ts    <- DB helpers: room dhundo, member check, message save
  .env        <- DATABASE_URL, JWT_SECRET (api jaisa hi!), REDIS_URL, PORT=5050
```

**Ek message ka safar:**

```
Client A  --WS "message"-->  ws-service
                               1. JWT se pata: kaun bhej raha hai
                               2. DB me message SAVE karo (Postgres)
                               3. Redis pe PUBLISH karo (channel "room:5")
                                        |
                               Redis sabko bhej deta hai
                                        |
                               har ws-service ka SUBSCRIBER sunta hai
                                        |
                          us room ke saare connected clients ko bhej do
                                        v
Client A, Client B, Client C  <--WS "message"--  (sabko dikh gaya)
```

---

## 3. `.env` — dhyaan dene wali baat

```
DATABASE_URL=postgresql://chat:chatpass@localhost:5432/chatdb
JWT_SECRET=akshjwt          <- api-service ke SAME hona chahiye!
REDIS_URL=redis://localhost:6379
PORT=5050
```

> **Zaroori:** `JWT_SECRET` api-service aur ws-service me bilkul same. Kyunki token
> api-service banata hai (`jwt.sign`) aur ws-service usse verify karta hai (`jwt.verify`).
> Secret alag hua toh verify fail = "invalid token".

---

## 4. Connection pe JWT auth (`index.ts`)

Problem: browser ka WebSocket `Authorization` header **set nahi kar sakta**. Toh token
URL me bhejte hain:

```
ws://localhost:5050?token=<jwt>
```

Server connection pe yeh karta hai:

```ts
wss.on('connection', (socket, req) => {
  const url = new URL(req.url ?? '', 'http://localhost');
  const token = url.searchParams.get('token');     // URL se token nikalo

  if (!token) { socket.close(); return; }          // token nahi -> bhagao

  try {
    const payload = jwt.verify(token, JWT_SECRET);  // valid?
    client.user = { userId: payload.userId, username: payload.username };
  } catch {
    socket.close(); return;                          // galat token -> bhagao
  }

  send(client, { type: 'ready', user: client.user }); // sab theek, chalo
});
```

Ab `client.user` me pata hai yeh socket kis user ka hai — har message pe kaam aayega.

---

## 5. Client aur server kya-kya bolte hain (protocol)

Sab JSON me. **Client -> server:**

| `type` | aur fields | matlab |
|---|---|---|
| `join` | `roomId` | "is room me aa gaya, ab iske live message bhejo" |
| `message` | `roomId`, `body` | "yeh message bhej do" |
| `leave` | `roomId` | "is room se nikal gaya" |

**Server -> client:**

| `type` | aur fields | matlab |
|---|---|---|
| `ready` | `user` | connection ho gaya, auth ok |
| `joined` | `roomId` | room join confirm |
| `message` | `message` | naya message aaya (object: id, room_id, sender_id, username, body, created_at) |
| `error` | `error` | kuch galat hua |

> Note: `message` object ka shape REST wale `GET /rooms/:id/messages` jaisa hi hai —
> taaki frontend ko sirf ek hi shape sambhalna pade. History REST se aati hai, live
> message WS se — dono same dikhte hain.

---

## 6. Join logic — kaun room me ghus sakta hai?

```ts
async function handleJoin(client, roomId) {
  const room = await getRoom(roomId);
  if (!room) return error('room not found');

  const member = await isMember(roomId, client.user.userId);
  if (!member) {
    if (room.type === 'public') {
      await addMember(roomId, client.user.userId);  // public room -> koi bhi join kar sakta
    } else {
      return error('not a member');                 // DM -> sirf members (2 log)
    }
  }

  addToRoom(roomId, client);   // local list me daalo (point 7)
  send(client, { type: 'joined', roomId });
}
```

Public room = sabke liye khula. DM = sirf woh 2 log jinke beech DM hai.

---

## 7. "Local rooms map" — yeh kya hai?

Har ws-service apni memory me ek map rakhta hai:

```ts
const roomSockets = new Map<number, Set<Client>>();
//          roomId  ->  us room ke andar IS server pe khule sockets
```

Jab koi join karta hai, uska socket us room ke set me add ho jaata hai. Jab naya message
us room ke liye aata hai, hum is set me ghoom ke sabko bhej dete hain. Disconnect pe socket
har set se hat jaata hai (`removeFromAllRooms`).

---

## 8. Message bhejne ka asli flow + Redis kyun?

```ts
async function handleMessage(client, roomId, body) {
  // 1. member ho (join ne set kar diya hota hai)
  // 2. DB me save
  const saved = await saveMessage(roomId, client.user.userId, client.user.username, body);

  // 3. Redis pe publish — SEEDHA local sockets ko nahi bhejte!
  await publisher.publish(roomChannel(roomId), JSON.stringify(saved));
}
```

**Redis pub/sub kyun?** Socho future me tum 2 ws-service chala rahe ho (zyada users handle
karne ke liye). Client A server-1 pe hai, Client B server-2 pe. A ne message bheja — agar
server-1 sirf apne local sockets ko bhejta, toh B (server-2 pe) ko kabhi nahi milta!

Solution: message ko **Redis pe publish** karo. Har server Redis ko **sun** raha hai. Toh
message har server tak pahunchta hai, aur har server apne local clients ko de deta hai.

```
              publish "room:5"
server-1  ----------------------->  REDIS
                                      |  (sab subscribers ko bhejo)
                    +-----------------+-----------------+
                    v                                   v
                server-1 subscriber              server-2 subscriber
                    |                                   |
              A ke sockets                        B ke sockets
```

### Do alag Redis connection kyun? (`redis.ts`)

```ts
export const publisher = createClient({ url: REDIS_URL });
export const subscriber = publisher.duplicate();   // alag connection
```

Redis ka rule: jo connection "subscribe mode" me hai woh normal commands (jaise publish)
nahi chala sakta. Isliye **publisher alag, subscriber alag**.

### Subscriber sabko deliver karta hai

```ts
await subscriber.pSubscribe('room:*', (message, channel) => {
  const roomId = roomIdFromChannel(channel);    // "room:5" -> 5
  const sockets = roomSockets.get(roomId);       // is server pe us room ke sockets
  for (const ws of sockets ?? []) {
    send(ws, { type: 'message', message: JSON.parse(message) });
  }
});
```

`pSubscribe('room:*')` = "room: se shuru hone wale SAARE channels suno" (pattern subscribe).
Ek hi subscription me saare rooms cover. (Simple rakha hai; chaaho toh per-room subscribe
bhi kar sakte ho — thoda zyada efficient, zyada code.)

> **Smart trick:** message bhejne wala (`handleMessage`) seedha local sockets ko NAHI bhejta —
> sirf publish karta hai. Delivery hamesha subscriber se hoti hai. Isse ek hi raasta rehta hai
> (kam bug), aur bhejne wale ko bhi apna message "echo" wapas mil jaata hai — frontend usse
> render kar leta hai.

---

## 9. DB helpers (`rooms.ts`)

- `getRoom(roomId)` — room exist karta hai? public ya dm?
- `isMember(roomId, userId)` — yeh user us room ka member hai?
- `addMember(roomId, userId)` — member bana do (`ON CONFLICT DO NOTHING` = pehle se hai toh chill)
- `saveMessage(...)` — message INSERT karo, full row (id, created_at ke saath) wapas do

Yeh sab `shared/db.ts` wala `query()` use karte hain — wahi pool jo api-service use karta hai.

---

## 10. Chala ke dekho

```bash
# pehle Postgres + Redis chalu hone chahiye:
docker compose up -d

# phir:
cd ws-service
npm run dev        # ws://localhost:5050 pe chalega
```

Browser console se test (pehle api-service se token le lo):

```js
const token = "eyJ...";   // /auth/login se
const ws = new WebSocket("ws://localhost:5050?token=" + token);
ws.onmessage = (e) => console.log("GOT:", JSON.parse(e.data));
ws.onopen = () => {
  ws.send(JSON.stringify({ type: "join", roomId: 1 }));
  ws.send(JSON.stringify({ type: "message", roomId: 1, body: "hello!" }));
};
```

`GOT: {type:'ready'...}`, phir `{type:'joined'...}`, phir tumhara message wapas aana chahiye.

---

## 11. Common galtiyan

- **Connect hote hi band ho jaata** -> token galat/missing, ya `JWT_SECRET` api se match nahi.
- **Message save hota hai par dusre ko nahi dikhta** -> Redis nahi chal raha (`docker compose up -d`),
  ya `REDIS_URL` galat. Subscriber connect hua kya? Log me "subscribed to room:*" dikhna chahiye.
- **"not a member of this room"** -> DM room me ho jiska tum member nahi, ya join se pehle hi
  message bhej diya.
- **`relation "messages" does not exist`** -> `schema.sql` DB me run nahi hua.
```
