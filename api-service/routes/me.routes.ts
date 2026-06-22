import { Router, Request, Response } from 'express';
import { query } from '../../shared/db';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

interface MyRoomRow {
  id: number;
  name: string | null;
  type: string;
  created_at: string;
}

// GET /me/rooms -> rooms (public + dm) the current user belongs to
router.get('/rooms', async (req: Request, res: Response) => {
  try {
    // For a DM the room has no name, so we show the OTHER member's username.
    const { rows } = await query<MyRoomRow>(
      `SELECT r.id,
              CASE WHEN r.type = 'public' THEN r.name
                   ELSE (SELECT u.username
                           FROM room_members m2
                           JOIN users u ON u.id = m2.user_id
                          WHERE m2.room_id = r.id AND m2.user_id <> $1
                          LIMIT 1)
              END AS name,
              r.type, r.created_at
         FROM rooms r
         JOIN room_members m ON m.room_id = r.id
        WHERE m.user_id = $1
        ORDER BY r.created_at DESC`,
      [req.user!.userId]
    );
    return res.json({ rooms: rows });
  } catch (err) {
    console.error('list my rooms error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
