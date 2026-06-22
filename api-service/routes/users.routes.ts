import { Router, Request, Response } from 'express';
import { query } from '../../shared/db';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

interface UserRow {
  id: number;
  username: string;
}

// GET /users -> everyone except me (so the client can start a DM with someone)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { rows } = await query<UserRow>(
      'SELECT id, username FROM users WHERE id <> $1 ORDER BY username ASC',
      [req.user!.userId]
    );
    return res.json({ users: rows });
  } catch (err) {
    console.error('list users error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
