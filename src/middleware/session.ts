import { Request, Response } from 'express';
import { User, getUserFromToken } from '../models/user';

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
    const user = await getUserFromToken(req.cookies.token);
    if (user) req.session = user;
  }

  next();
}
