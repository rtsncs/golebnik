import { Request, Response } from 'express';
import { verify } from 'jsonwebtoken';
import { User, getUserById } from '../models/user';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    export interface Request {
      session?: User;
    }
  }
}

export default async function jwt(
  req: Request,
  _res: Response,
  next: () => void,
) {
  if (req.cookies.token) {
    try {
      if (!process.env.AUTH_SECRET) console.log('AUTH_SECRET is not set');
      const decoded: any = verify(
        req.cookies.token,
        process.env.AUTH_SECRET || 'secret',
      );
      req.session = await getUserById(decoded.id);
    } catch (e) {}
  }

  next();
}
