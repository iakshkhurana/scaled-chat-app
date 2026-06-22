import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../../shared/db';

const router = Router();

interface UserToken {
  id: number;
  username: string;
}

function signToken(user: UserToken): string {
  return jwt.sign(
    { userId: user.id, username: user.username },
    process.env.JWT_SECRET as string,
    { expiresIn: '7d' }
  );
}

router.post('/register', async (req: Request, res: Response) => {
  const { email, username, password } = req.body ?? {};

  if (!email || !username || !password) {
    return res.status(400).json({ error: 'email, username and password are required' });
  }

  try {
    const password_hash = await bcrypt.hash(password, 10);

    const { rows } = await query<UserToken>(
      'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, username',
      [email, username, password_hash]
    );

    return res.status(201).json({ token: signToken(rows[0]) });
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'email already registered' });
    }
    console.error('register error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const { rows } = await query<UserToken & { password_hash: string }>(
      'SELECT id, username, password_hash FROM users WHERE email = $1',
      [email]
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    return res.json({ token: signToken(user) });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
