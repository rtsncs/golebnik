import { Router, Request, Response } from 'express';
import { getUser } from '../models/user';
import { sign } from 'jsonwebtoken';

interface LoginForm {
  username: string;
  password: string;
}

export default function (router: Router) {
  router.get('/login', (req: Request, res: Response) => {
    res.render('login', {
      title: 'zaloguj',
      user: req.session,
      callback: req.query.callback || '/',
    });
  });
  router.post('/login', async (req: Request, res: Response) => {
    const formData: LoginForm = req.body;
    const user = await getUser(formData.username);
    if (!user || !(await user.verifyPassword(formData.password)))
      res.sendStatus(401);
    else {
      if (!process.env.AUTH_SECRET) console.log('AUTH_SECRET is not set');
      const token = sign({ id: user.id }, process.env.AUTH_SECRET || 'secret');
      res.cookie('token', token, { maxAge: 2592000000 });
      res.redirect((req.query.callback as string) || '/');
    }
  });
  return router;
}
