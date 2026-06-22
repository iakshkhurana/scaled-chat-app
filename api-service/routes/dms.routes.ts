import { Router, Request, Response } from 'express';
import { pool, query } from '../../shared/db';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

// POST /dms/:userId -> find-or-create a DM room between req.user and :userId
router.post('/:userId', async (req: Request, res: Response) => {
  const me = req.user!.userId;
  const otherId = Number(req.params.userId);

  if (!Number.isInteger(otherId)) {
    return res.status(400).json({ error: 'invalid user id' });
  }
  if (otherId === me) {
    return res.status(400).json({ error: 'cannot DM yourself' });
  }

  try {
    // Make sure the target user exists.
    const { rows: userRows } = await query<{ id: number }>(
      'SELECT id FROM users WHERE id = $1',
      [otherId]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'user not found' });
    }

    // Is there already a dm room with exactly these two members?
    const { rows: existing } = await query<{ id: number }>(
      `SELECT r.id
         FROM rooms r
         JOIN room_members m1 ON m1.room_id = r.id AND m1.user_id = $1
         JOIN room_members m2 ON m2.room_id = r.id AND m2.user_id = $2
        WHERE r.type = 'dm'
        LIMIT 1`,
      [me, otherId]
    );
    if (existing.length > 0) {
      return res.json({ roomId: existing[0].id });
    }

    // None found -> create one with both members.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO rooms (type) VALUES ('dm') RETURNING id`
      );
      const roomId = rows[0].id;

      await client.query(
        `INSERT INTO room_members (room_id, user_id) VALUES ($1, $2), ($1, $3)`,
        [roomId, me, otherId]
      );

      await client.query('COMMIT');
      return res.status(201).json({ roomId });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('create dm error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
