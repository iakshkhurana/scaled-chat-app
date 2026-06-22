import { query } from '../shared/db';

// The exact shape we broadcast to clients. Matches the REST history endpoint
// (GET /rooms/:id/messages) so the frontend handles ONE message shape.
export interface ChatMessage {
  id: string; // BIGSERIAL -> string
  room_id: number;
  sender_id: number;
  username: string;
  body: string;
  created_at: string;
}

interface RoomRow {
  id: number;
  type: string;
}

export async function getRoom(roomId: number): Promise<RoomRow | null> {
  const { rows } = await query<RoomRow>('SELECT id, type FROM rooms WHERE id = $1', [roomId]);
  return rows[0] ?? null;
}

export async function isMember(roomId: number, userId: number): Promise<boolean> {
  const { rows } = await query(
    'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
    [roomId, userId]
  );
  return rows.length > 0;
}

export async function addMember(roomId: number, userId: number): Promise<void> {
  await query(
    'INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [roomId, userId]
  );
}

// Insert the message, then return the full row (with the sender's username)
// ready to broadcast.
export async function saveMessage(
  roomId: number,
  senderId: number,
  username: string,
  body: string
): Promise<ChatMessage> {
  const { rows } = await query<{ id: string; created_at: string }>(
    `INSERT INTO messages (room_id, sender_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, created_at`,
    [roomId, senderId, body]
  );
  const saved = rows[0];

  return {
    id: saved.id,
    room_id: roomId,
    sender_id: senderId,
    username,
    body,
    created_at: saved.created_at,
  };
}
