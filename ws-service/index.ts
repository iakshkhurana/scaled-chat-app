import 'dotenv/config';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import {
  publisher,
  subscriber,
  connectRedis,
  roomChannel,
  roomIdFromChannel,
} from './redis';
import { getRoom, isMember, addMember, saveMessage } from './rooms';

interface TokenPayload {
  userId: number;
  username: string;
}

// A connected socket, tagged with who they are and which rooms they joined.
interface Client extends WebSocket {
  user: TokenPayload;
  rooms: Set<number>;
}

// roomId -> set of LOCAL sockets in that room (only the ones on THIS instance).
const roomSockets = new Map<number, Set<Client>>();

function addToRoom(roomId: number, client: Client) {
  if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set());
  roomSockets.get(roomId)!.add(client);
  client.rooms.add(roomId);
}

function removeFromAllRooms(client: Client) {
  for (const roomId of client.rooms) {
    roomSockets.get(roomId)?.delete(client);
  }
  client.rooms.clear();
}

function send(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

// ---- HTTP server (just for the WS upgrade + a health check) ----
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200).end('ok');
    return;
  }
  res.writeHead(426).end('upgrade required'); // this port speaks WebSocket
});

const wss = new WebSocketServer({ server });

wss.on('connection', (socket, req) => {
  const client = socket as Client;
  client.rooms = new Set();

  // Browsers can't set headers on a WebSocket, so the token comes in the URL:
  //   ws://localhost:5050?token=<jwt>
  const url = new URL(req.url ?? '', 'http://localhost');
  const token = url.searchParams.get('token');

  if (!token) {
    send(client, { type: 'error', error: 'missing token' });
    client.close();
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
    client.user = { userId: payload.userId, username: payload.username };
  } catch {
    send(client, { type: 'error', error: 'invalid token' });
    client.close();
    return;
  }

  send(client, { type: 'ready', user: client.user });

  client.on('message', async (raw) => {
    let msg: { type?: string; roomId?: number; body?: string };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(client, { type: 'error', error: 'invalid JSON' });
    }

    try {
      if (msg.type === 'join') {
        await handleJoin(client, Number(msg.roomId));
      } else if (msg.type === 'message') {
        await handleMessage(client, Number(msg.roomId), String(msg.body ?? ''));
      } else if (msg.type === 'leave') {
        const roomId = Number(msg.roomId);
        roomSockets.get(roomId)?.delete(client);
        client.rooms.delete(roomId);
      } else {
        send(client, { type: 'error', error: `unknown type: ${msg.type}` });
      }
    } catch (err) {
      console.error('handler error:', err);
      send(client, { type: 'error', error: 'internal error' });
    }
  });

  client.on('close', () => removeFromAllRooms(client));
});

// ---- Join a room: must be a member; public rooms auto-join ----
async function handleJoin(client: Client, roomId: number) {
  if (!Number.isInteger(roomId)) {
    return send(client, { type: 'error', error: 'invalid roomId' });
  }

  const room = await getRoom(roomId);
  if (!room) {
    return send(client, { type: 'error', error: 'room not found' });
  }

  const member = await isMember(roomId, client.user.userId);
  if (!member) {
    if (room.type === 'public') {
      await addMember(roomId, client.user.userId); // anyone can join a public room
    } else {
      return send(client, { type: 'error', error: 'not a member of this room' });
    }
  }

  addToRoom(roomId, client);
  send(client, { type: 'joined', roomId });
}

// ---- Send a message: persist -> publish to Redis (fan-out happens there) ----
async function handleMessage(client: Client, roomId: number, body: string) {
  if (!Number.isInteger(roomId) || !body.trim()) {
    return send(client, { type: 'error', error: 'roomId and non-empty body required' });
  }

  // Must be in the room to post (join sets this up).
  if (!client.rooms.has(roomId)) {
    const member = await isMember(roomId, client.user.userId);
    if (!member) return send(client, { type: 'error', error: 'not a member of this room' });
    addToRoom(roomId, client);
  }

  const saved = await saveMessage(roomId, client.user.userId, client.user.username, body.trim());

  // Publish only. We do NOT send to local sockets here — the subscriber below
  // delivers to everyone (local + other instances) through one code path, so
  // the sender gets their own message echoed back too.
  await publisher.publish(roomChannel(roomId), JSON.stringify(saved));
}

// ---- Redis subscriber: deliver any published message to local sockets ----
async function startSubscriber() {
  await subscriber.pSubscribe('room:*', (message, channel) => {
    const roomId = roomIdFromChannel(channel);
    const sockets = roomSockets.get(roomId);
    if (!sockets) return;

    const parsed = JSON.parse(message);
    for (const ws of sockets) {
      send(ws, { type: 'message', message: parsed });
    }
  });
  console.log('subscribed to room:*');
}

async function main() {
  await connectRedis();
  await startSubscriber();

  const port = Number(process.env.PORT) || 5050;
  server.listen(port, () => console.log(`ws-service listening on ${port}`));
}

main().catch((err) => {
  console.error('failed to start ws-service:', err);
  process.exit(1);
});
