import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  userId: number;
  username: string;
}

// Make req.user available everywhere via declaration merging.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Reads "Authorization: Bearer <token>", verifies it, attaches req.user.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing or malformed Authorization header' });
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as AuthUser;
    req.user = { userId: payload.userId, username: payload.username };
    return next();
  } catch {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
}
