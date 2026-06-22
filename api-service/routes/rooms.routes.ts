import { Router, Request, Response } from 'express';
import { pool, query } from '../../shared/db';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Every endpoint in this router needs a valid token.
router.use(requireAuth);

interface RoomRow {
  id: number;
  name: string | null;
  type: string;
  created_at: string;
}

// GET /rooms -> list public rooms
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await query<RoomRow>(
      `SELECT id, name, type, created_at
         FROM rooms
        WHERE type = 'public'
        ORDER BY created_at DESC`
    );
    return res.json({ rooms: rows });
  } catch (err) {
    console.error('list rooms error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// POST /rooms -> create a public room (creator is added as a member)
router.post('/', async (req: Request, res: Response) => {
  const { name } = req.body ?? {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query<RoomRow>(
      `INSERT INTO rooms (name, type) VALUES ($1, 'public')
       RETURNING id, name, type, created_at`,
      [name.trim()]
    );
    const room = rows[0];

    await client.query(
      `INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)`,
      [room.id, req.user!.userId]
    );

    await client.query('COMMIT');
    return res.status(201).json({ room });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('create room error:', err);
    return res.status(500).json({ error: 'internal server error' });
  } finally {
    client.release();
  }
});

interface MessageRow {
  id: string; // BIGSERIAL comes back as string from pg
  room_id: number;
  sender_id: number;
  username: string;
  body: string;
  created_at: string;
}

// GET /rooms/:id/messages?before=<cursor>&limit=<n> -> paginated history (newest first)
// `before` is the id of the oldest message you already have (keyset pagination).
router.get('/:id/messages', async (req: Request, res: Response) => {
  const roomId = Number(req.params.id);
  if (!Number.isInteger(roomId)) {
    return res.status(400).json({ error: 'invalid room id' });
  }

  const before = req.query.before !== undefined ? Number(req.query.before) : null;
  if (before !== null && !Number.isInteger(before)) {
    return res.status(400).json({ error: 'invalid before cursor' });
  }

  let limit = Number(req.query.limit) || 50;
  limit = Math.min(Math.max(limit, 1), 100);

  try {
    const { rows } = await query<MessageRow>(
      `SELECT m.id, m.room_id, m.sender_id, u.username, m.body, m.created_at
         FROM messages m
         JOIN users u ON u.id = m.sender_id
        WHERE m.room_id = $1
          AND ($2::bigint IS NULL OR m.id < $2)
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT $3`,
      [roomId, before, limit]
    );

    // Oldest id in this page -> next `before` cursor (null when no more).
    const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

    return res.json({ messages: rows, nextCursor });
  } catch (err) {
    console.error('list messages error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
