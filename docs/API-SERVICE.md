# api-service — kaise kaam karta hai (beginner guide)

Yeh doc tumhare `api-service` ko line-by-line concept ke saath samjhata hai.
Agar TypeScript / Express / `declare` / JWT naye lag rahe hain — yahi se padho.

---

## 1. Bada picture (folder structure)

```
api-service/
  index.ts              <- app start hota hai yahin se (entry point)
  .env                  <- secrets (DATABASE_URL, JWT_SECRET, PORT)
  middleware/
    auth.ts             <- token check karne wala "guard"
  routes/
    auth.routes.ts      <- /auth/register, /auth/login
    rooms.routes.ts     <- /rooms ... (rooms + messages)
    dms.routes.ts       <- /dms/:userId
    me.routes.ts        <- /me/rooms
shared/
  db.ts                 <- Postgres connection (dono services use karti hain)
  schema.sql            <- tables ka design
```

**Request ka flow** (jab koi client call karta hai):

```
Client  --->  index.ts (app)  --->  router (sahi file)  --->  middleware (auth)  --->  handler  --->  DB  --->  response
```

---

## 2. TypeScript: bas itna samajh lo

TypeScript = JavaScript + **types**. Type matlab "yeh variable kis cheez ka hai".

```ts
let name: string = "aksh";   // string
let age: number = 21;        // number
let ok: boolean = true;      // true/false
```

### `interface` — ek object ka "shape"

Yeh keh raha hai "ek user aisa dikhta hai":

```ts
interface AuthUser {
  userId: number;
  username: string;
}
```

Ab jaha bhi `AuthUser` likha, TS expect karega ki usme `userId` (number) aur
`username` (string) honge. Galti karoge toh editor red line de dega — yahi TS ka faida.

### `?` — optional

```ts
user?: AuthUser;   // user ho bhi sakta hai, nahi bhi (undefined)
```

### `as` — "TS, bharosa kar, yeh isi type ka hai"

```ts
const payload = jwt.verify(token, secret) as AuthUser;
```

`jwt.verify` ko nahi pata kya wapas aayega, toh hum `as AuthUser` bol ke bata dete hain.

### `<T>` — generic (type ek "parameter" ki tarah)

```ts
query<RoomRow>(...)   // is query ke rows "RoomRow" type ke honge
```

Itna kaafi hai. Baaki sab isi ke around hai.

---

## 3. `index.ts` — sab kuch yahin judta hai

```ts
import 'dotenv/config';     // .env file ko process.env me load karta hai (sabse pehle!)
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import roomsRoutes from './routes/rooms.routes';
// ...

const app = express();      // app ban gaya

app.use(cors());            // doosre origin (client) se calls allow
app.use(express.json());    // request body ko JSON me parse kare (warna req.body undefined)

app.use('/auth', authRoutes);    // /auth se start hone wali sab requests -> auth.routes.ts
app.use('/rooms', roomsRoutes);  // /rooms... -> rooms.routes.ts
app.use('/dms', dmsRoutes);
app.use('/me', meRoutes);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`api-service listening on ${port}`));
```

Important baatein:
- `import 'dotenv/config'` **sabse upar** hona chahiye. Kyunki `shared/db.ts` import hote hi
  `process.env.DATABASE_URL` padhta hai — agar `.env` load nahi hua toh undefined milega.
- `app.use('/rooms', roomsRoutes)` ka matlab: us file ke andar jo `'/'` likha hai woh
  asal me `/rooms` hai, `'/:id/messages'` asal me `/rooms/:id/messages` hai. Prefix juda hota hai.

---

## 4. Routes kya hote hain (Express)

Ek "route" = ek URL + HTTP method + uska kaam karne wala function.

```ts
import { Router, Request, Response } from 'express';

const router = Router();    // ek mini-app, sirf routes rakhne ke liye

router.get('/', (req, res) => {        // GET request
  res.json({ hello: 'world' });        // response bhejo
});

router.post('/', (req, res) => {       // POST request
  const data = req.body;               // client ne jo bheja
  res.status(201).json({ ok: true });  // 201 = created
});

export default router;                  // index.ts ise import karega
```

- `req` = **request** (client kya bhej raha hai: `req.body`, `req.params`, `req.query`, `req.headers`)
- `res` = **response** (tum kya wapas bhej rahe ho: `res.json(...)`, `res.status(400)...`)
- `Request, Response` types sirf editor ki madad ke liye hain (autocomplete + galti pakadna).

### `req` ke 3 jagah se data aata hai

| Kahan se | Kaisa URL | Code | Example |
|---|---|---|---|
| `req.params` | `/rooms/:id` | `req.params.id` | `/rooms/5` -> `"5"` |
| `req.query` | `?before=10` | `req.query.before` | `/rooms/5/messages?before=10` -> `"10"` |
| `req.body` | POST ki JSON body | `req.body.name` | `{ "name": "general" }` -> `"general"` |

> Note: `params` aur `query` hamesha **string** dete hain. Isliye code me `Number(req.params.id)`
> karke number banate hain.

### HTTP status codes (jo tumhare code me hain)

- `200` OK (default, `res.json` se)
- `201` Created (kuch naya banaya — register, naya room)
- `400` Bad Request (client ne galat/adhura data bheja)
- `401` Unauthorized (token nahi/galat)
- `404` Not Found (cheez exist nahi karti)
- `409` Conflict (already exist — jaise email pehle se registered)
- `500` Internal Server Error (server ki galti / crash)

---

## 5. Middleware kya hai? (`middleware/auth.ts`)

Middleware = ek function jo handler se **pehle** chalta hai. Soch lo darwaaze ka guard:
token sahi hai toh aage jaane do (`next()`), warna roko (`401`).

```ts
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;        // "Bearer eyJ..."

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing token' });   // ROKO
  }

  const token = header.slice('Bearer '.length).trim();         // sirf token nikalo

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as AuthUser;
    req.user = { userId: payload.userId, username: payload.username };  // user ko request pe chipka do
    return next();                                              // JAANE DO
  } catch {
    return res.status(401).json({ error: 'invalid token' });    // token galat/expire
  }
}
```

Teesra param `next` important hai: `next()` call karoge tabhi request aage handler tak jaayegi.

Aur har protected route ke upar yeh likha hai:

```ts
router.use(requireAuth);   // is file ke SAARE routes pehle auth check karenge
```

Toh `/rooms`, `/dms`, `/me` — sab pe token zaroori hai. `/auth/register` aur `/auth/login`
pe nahi (kyunki tab toh token hota hi nahi).

---

## 6. Woh ajeeb `declare global` kya hai?

Problem: Express ke `req` me by default `req.user` naam ki cheez nahi hoti. Hum manually
`req.user = ...` set kar rahe hain. TypeScript chillata hai: "`user` toh exist hi nahi karta!"

Solution: TS ko bolo ki "`Request` me ek aur cheez add kar do — `user`". Isko
**declaration merging** kehte hain (apni property ghusana ek existing type me).

```ts
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;     // ab har req pe req.user allowed hai (optional)
    }
  }
}
```

- `declare` = "TS, yeh sirf type ki jaankari hai, isse koi real code generate mat karo".
- `global` = poore project me lagu.
- `Express { Request }` = Express ke andar wali `Request` ko hi extend kar rahe hain.

Isi wajah se baaki files me `req.user!.userId` likh paate hain bina error ke.

> `!` ka matlab: "TS, mujhe pata hai yeh `undefined` nahi hai" (kyunki middleware ne set kar diya).

---

## 7. Auth ka asli kaam: password + JWT (`routes/auth.routes.ts`)

### Register
```ts
const password_hash = await bcrypt.hash(password, 10);  // plain password ko scramble karo
// 10 = "cost". Original password kabhi DB me save nahi hota.

await query(
  'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, username',
  [email, username, password_hash]
);
```

### Login
```ts
const ok = await bcrypt.compare(password, user.password_hash);  // match karta hai?
if (!ok) return res.status(401)...
```

### JWT (token) — login/register pe banta hai
```ts
jwt.sign(
  { userId: user.id, username: user.username },   // payload (token ke andar ki info)
  process.env.JWT_SECRET,                         // secret se sign (taaki koi nakli na bana sake)
  { expiresIn: '7d' }                             // 7 din baad expire
);
```

Token client apne paas rakhta hai aur har request me `Authorization: Bearer <token>` bhejta hai.
Server `jwt.verify` se check karta hai (woh middleware me hota hai, point 5).

### `await` / `async` kya hai?
DB call, hashing — yeh "time lagta hai" wale kaam hain. `await` matlab "ruk, jawab aane do,
phir aage badh". Jis function me `await` hai usse `async` likhna padta hai:
```ts
router.post('/login', async (req, res) => { ... await ... });
```

---

## 8. Database (`shared/db.ts`) — pool, query, transaction

### Pool kya hai?
Har request pe nayi DB connection banana mehnga hai. **Pool** = pehle se khuli hui
connections ka set, jisme se ek udhaar lete ho aur kaam ke baad wapas. Reuse = fast.

```ts
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export function query(text, params) {
  return pool.query(text, params);   // simple, ek-line wale queries ke liye
}
```

### `$1, $2` parameters — SQL injection se bachne ke liye
Kabhi bhi user ka data seedha SQL string me mat jodo. Hamesha `$1, $2` use karo:
```ts
query('SELECT * FROM users WHERE email = $1', [email]);   // safe ✅
// query('... WHERE email = ' + email)  <- KABHI NAHI ❌ (hack ho sakta hai)
```

### Transaction — "ya toh sab, ya kuch nahi"
DM banate waqt 2 cheezein karni hai: (1) room banao, (2) dono members add karo.
Agar pehla ho gaya aur doosra fail — toh aadha-adhoora data reh jaayega. Transaction
isse rokta hai: `COMMIT` (sab save) ya `ROLLBACK` (sab undo).

```ts
const client = await pool.connect();   // ek dedicated connection
try {
  await client.query('BEGIN');         // transaction shuru

  const { rows } = await client.query(`INSERT INTO rooms (type) VALUES ('dm') RETURNING id`);
  const roomId = rows[0].id;
  await client.query('INSERT INTO room_members ... VALUES ($1,$2),($1,$3)', [roomId, me, otherId]);

  await client.query('COMMIT');        // dono safal -> save
} catch (err) {
  await client.query('ROLLBACK');      // koi fail -> sab undo
  throw err;
} finally {
  client.release();                    // connection pool ko wapas (HAMESHA)
}
```

Single (akeli) query ke liye transaction ki zaroorat nahi — bas `query(...)` use karo.

---

## 9. Pagination samajh lo (`GET /rooms/:id/messages`)

Ek room me hazaaron message ho sakte hain. Sab ek saath bhejna bekaar hai. Toh thode-thode
karke bhejte hain — isko pagination kehte hain.

Hum **keyset** (cursor) pagination use karte hain:
- Pehli call: latest 50 message milte hain + `nextCursor` (sabse purane message ki id).
- Agli call: `?before=<woh cursor>` bhejo -> usse purane 50 milenge.
- `nextCursor` `null` aa gaya -> aur message nahi bache.

```ts
WHERE m.room_id = $1
  AND ($2::bigint IS NULL OR m.id < $2)   // before diya hai toh usse purane
ORDER BY m.created_at DESC, m.id DESC      // naye sabse upar
LIMIT $3                                   // ek baar me itne hi
```

Yeh `schema.sql` wale index `idx_messages_room_created (room_id, created_at DESC)` ka
fayda uthata hai — isliye fast rehta hai.

---

## 10. Saare endpoints ek nazar me

| Method | URL | Token chahiye? | Kaam |
|---|---|---|---|
| POST | `/auth/register` | ❌ | naya user + token |
| POST | `/auth/login` | ❌ | login + token |
| GET | `/rooms` | ✅ | public rooms ki list |
| POST | `/rooms` | ✅ | naya public room (creator member ban jaata hai) |
| GET | `/rooms/:id/messages?before=<id>` | ✅ | room ki history (paginated) |
| POST | `/dms/:userId` | ✅ | DM room dhundo ya banao -> roomId |
| GET | `/me/rooms` | ✅ | meri saari rooms (public + dm) |

---

## 11. Chala ke dekho (test)

```bash
cd api-service
npm run dev          # http://localhost:4000 pe chalega

# 1) register -> token milega
curl -X POST localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"a@a.com","username":"aksh","password":"123456"}'

# 2) us token ko copy karke (TOKEN me) protected route call karo
TOKEN=eyJ...   # upar wale response se
curl -H "Authorization: Bearer $TOKEN" localhost:4000/rooms

# 3) room banao
curl -X POST localhost:4000/rooms \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"general"}'

# 4) uski (khaali) history dekho
curl -H "Authorization: Bearer $TOKEN" localhost:4000/rooms/1/messages
```

Windows pe `curl` chalta hai (PowerShell). Token ke liye Postman bhi use kar sakte ho —
aasaan rehta hai.

---

## 12. Common galtiyan (jab kuch na chale)

- **`req.body` undefined aa raha** -> `app.use(express.json())` missing hai, ya request me
  `Content-Type: application/json` header nahi bheja.
- **`401` har jagah** -> token bhej nahi rahe, ya `Bearer ` likhna bhool gaye, ya
  `.env` ka `JWT_SECRET` sign aur verify dono jagah same nahi.
- **DB connect nahi ho raha** -> Docker (postgres) chal raha hai? `.env` ka `DATABASE_URL` sahi hai?
  `import 'dotenv/config'` sabse upar hai?
- **`column ... does not exist`** -> `schema.sql` DB me run hua kya? Table/column ke naam match kar rahe?
```
