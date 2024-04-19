import { Router, Request, Response } from 'express';
import { createUser } from '../models/user';

interface RegisterForm {
  username: string;
  password: string;
}

export default function (router: Router) {
  router.get('/register', (req: Request, res: Response) => {
    res.render('register', {
      title: 'rejestracja',
      user: req.session,
      error: req.query.error,
    });
  });
  router.post('/register', async (req: Request, res: Response) => {
    const formData: RegisterForm = req.body;
    try {
      await createUser(formData.username, formData.password);
      res.redirect(303, '/');
    } catch (e) {
      res.redirect(303, `/register?error=${e}`);
    }
  });
  return router;
}
