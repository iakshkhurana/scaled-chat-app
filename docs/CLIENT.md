# client — React frontend (beginner guide)

Yeh tumhara chat UI hai: Vite + React + TypeScript. Editorial black/white design
(Agnost-style). Yahan har file ka kaam + React ke zaroori concepts samjhaye hain.

---

## 1. Bada picture (folder)

```
client/
  .env                       <- VITE_API_URL, VITE_WS_URL
  index.html                 <- <div id="root">, yahin React mount hota hai
  src/
    main.tsx                 <- React ko root pe chipkata hai (entry)
    App.tsx                  <- token hai? -> ChatApp, warna -> AuthScreen
    index.css                <- POORA design system (colors, fonts, layout)
    types.ts                 <- Room / Message / User ke TypeScript shapes
    lib/
      auth.ts                <- token localStorage me + JWT decode
      api.ts                 <- REST calls (fetch wrapper)
      useSocket.ts           <- WebSocket connection (custom hook)
    components/
      Logo.tsx               <- ◎ logo (SVG)
      AuthScreen.tsx         <- login / register
      ChatApp.tsx            <- main layout + saara state (dimaag yahan hai)
      Sidebar.tsx            <- rooms + DMs ki list
      RoomView.tsx           <- messages + type-box
      NewRoomModal.tsx       <- naya room banao
      NewDmModal.tsx         <- naya DM shuru karo
```

---

## 2. React ka 1-minute crash course

**Component** = ek function jo UI (JSX) return karta hai.

```tsx
function Hello({ name }: { name: string }) {   // props = bahar se aaya data
  return <h1>Hi {name}</h1>;
}
```

**State** = component ki yaad-daasht. Badle toh UI dubara render hota hai.

```tsx
const [count, setCount] = useState(0);   // count padho, setCount se badlo
<button onClick={() => setCount(count + 1)}>{count}</button>
```

**Effect** = "render ke baad kuch karo" (data fetch, connection kholo).

```tsx
useEffect(() => {
  getRooms().then(setRooms);   // mount hote hi rooms le aao
}, []);                        // [] = sirf ek baar (shuru me)
```

Bas itna samajh lo, baaki sab isi pe khada hai.

---

## 3. `main.tsx` aur `App.tsx`

`main.tsx` React ko `index.html` ke `<div id="root">` pe lagata hai. Chhota sa hai.

`App.tsx` = "kaun sa screen dikhaun?" wala decision:

```tsx
const [token, setTokenState] = useState(getToken());   // localStorage se token
const me = token ? decodeToken(token) : null;          // token se username nikalo

if (!token || !me) return <AuthScreen onAuthed={...} />;  // login nahi -> auth screen
return <ChatApp token={token} me={me} onLogout={...} />;   // login hai -> chat
```

Login karte hi token save hota hai aur React dubara render karke ChatApp dikha deta hai.

---

## 4. Token kaise sambhalte hain (`lib/auth.ts`)

- `setToken / getToken / clearToken` — token `localStorage` me (refresh ke baad bhi login rahe).
- `decodeToken(token)` — JWT ke beech wale hisse (payload) ko padh ke `{ userId, username }`
  nikaalta hai. **Sirf dikhane ke liye** — security ke liye nahi (server hi asli check karta hai).

JWT 3 hisson ka hota hai `header.payload.signature`. Hum bas payload (base64) decode karte hain.

---

## 5. REST calls (`lib/api.ts`)

Ek chhota `request()` wrapper jo har call me:
1. URL ke aage `VITE_API_URL` lagata hai,
2. `Authorization: Bearer <token>` apne aap add karta hai,
3. error aaye toh server ka message throw karta hai (UI dikha sake).

```ts
async function request(path, options) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json',
               ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}
```

Iske upar chhote functions: `login`, `register`, `getPublicRooms`, `createRoom`,
`getMyRooms`, `getMessages`, `getUsers`, `createDm`. UI inhi ko call karta hai, fetch ki
details se matlab nahi rakhta.

---

## 6. WebSocket hook (`lib/useSocket.ts`) — dil ki dhadkan

Yeh ek **custom hook** hai jo poore app ke liye **ek hi** WebSocket connection sambhalta hai.

```ts
const { ready, join, sendMessage } = useSocket(token, (event) => {
  // server se koi bhi event aaye toh yeh chalta hai
});
```

Andar kya hota hai:
- `token` aate hi connection kholta hai: `new WebSocket(WS_URL + "?token=" + token)`.
- Har incoming message pe `onEvent(...)` call karta hai.
- `join(roomId)` aur `sendMessage(roomId, body)` server ko JSON bhejte hain.
- `ready` batata hai connection live hai ya nahi (upar wala green dot).

**Ek chalaaki:** callback ko `useRef` me rakha hai (`onEventRef`). Isse jab handler badalta
hai tab connection dubara nahi khulta — warna har render pe reconnect hota. (Yeh React ka
common pattern hai, ratne ki zaroorat nahi, bas pata ho.)

---

## 7. `ChatApp.tsx` — saara dimaag yahin

Yeh saara state rakhta hai aur baaki components ko props se data deta hai:

```ts
publicRooms      // GET /rooms se (saare public rooms)
dmRooms          // GET /me/rooms se, sirf type==='dm'
activeRoom       // abhi khula room
messagesByRoom   // { [roomId]: Message[] }  <- har room ke message alag
```

**Room kholne pe (`selectRoom`):**
1. `activeRoom` set karo,
2. WS pe `join(roomId)` bhejo (ab is room ke live message aayenge),
3. REST se history le aao (`getMessages`) — woh newest-first deti hai, isliye `.reverse()`
   karke purane-se-naye kar dete hain.

**Live message aane pe (useSocket callback):**
```ts
if (event.type === 'message') {
  // us room ki list me jod do — agar wahi id pehle se hai toh skip (apna echo)
}
```

**Message bhejne pe:** bas `sendMessage(activeRoom.id, body)`. Hum khud screen pe turant
nahi daalte — server message ko save karke wapas "echo" bhejta hai, wahi list me add hota
hai. Isse jo screen pe dikhta hai woh exactly wahi hai jo DB me gaya (ek hi sach).

> Why `messagesByRoom` (sab rooms ek object me)? Taaki room switch karne pe har room ke
> message yaad rahein, aur background room me aaya message bhi store ho jaaye.

---

## 8. Baaki components (chhote + saaf)

- **Sidebar.tsx** — sirf list dikhata hai. Props: rooms, active room, aur click/`+` ke
  callbacks. Khud koi data fetch nahi karta ("dumb" component — saaf aur reusable).
- **RoomView.tsx** — header + message list + neeche type-box. Apna message right me kaala
  bubble, dusro ka left me. Naya message aate hi neeche auto-scroll (`scrollIntoView` in a
  `useEffect`). Enter ya Send button se bhejta hai.
- **NewRoomModal.tsx** — naam lo -> `createRoom` -> naya room select.
- **NewDmModal.tsx** — `getUsers` se logo ki list -> kisi pe click -> `createDm` -> DM khulta hai.
- **Logo.tsx** — ◎ wala SVG (concentric circles).

---

## 9. Design system (`index.css`) — look kaise aata hai

Saari styling yahin hai. Upar **CSS variables** (tokens) define hain:

```css
:root {
  --ink: #0a0a0a;        /* near-black text + buttons */
  --bg: #ffffff;
  --line: #e6e6e3;       /* patli borders */
  --font-display: 'Space Grotesk';   /* bade headings */
  --font-mono: 'Space Mono';         /* UPPERCASE labels */
  --font-body: 'Inter';              /* normal text */
}
```

Phir reusable classes: `.btn` / `.btn-primary` (kaala button), `.mono-label` (uppercase
spaced labels), `.input`, `.modal`, layout (`.topbar`, `.sidebar`, `.messages`...).
Editorial look = white background + thin black borders + monospace uppercase labels +
bade geometric headings. Color badalna ho? Bas upar token badlo.

> Fonts Google Fonts se `@import` ho rahe hain (top of file), isliye pehli baar net chahiye.

---

## 10. Chala ke dekho

```bash
# teeno cheezein chalu honi chahiye:
docker compose up -d         # postgres + redis
cd api-service && npm run dev   # :4000
cd ws-service && npm run dev    # :5050

# phir client:
cd client && npm run dev        # :5173 (Vite kholega)
```

Browser me `http://localhost:5173` -> register karo -> room banao -> message bhejo.
Do alag browser (ya ek normal + ek incognito) me alag user se login karke realtime dekho.

---

## 11. Common galtiyan

- **Login/calls fail** -> api-service chal raha? `.env` me `VITE_API_URL` sahi? (Vite ki
  env var `VITE_` se shuru honi ZAROORI hai, warna `import.meta.env` me nahi aati.)
- **Message bhejne pe kuch nahi hota** -> ws-service chal raha? green dot on hai? `VITE_WS_URL` sahi?
- **`.env` badla par asar nahi** -> Vite dev server **restart** karo (env startup pe padhti hai).
- **CORS error** -> api-service me `app.use(cors())` hai (already laga hua), phir bhi aaye to
  api-service restart karo.
```
