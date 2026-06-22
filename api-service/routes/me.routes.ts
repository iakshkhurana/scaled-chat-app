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
    const { rows } = await query<MyRoomRow>(
      `SELECT r.id, r.name, r.type, r.created_at
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
