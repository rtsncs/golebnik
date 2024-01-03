import { Router, Request, Response } from 'express';
import { createUser } from '../models/user';

interface RegisterForm {
  username: string;
  password: string;
}

export default function (router: Router) {
  //TODO: validate data
  router.get('/register', (req: Request, res: Response) => {
    res.render('register', { title: 'rejestracja', user: req.session });
  });
  router.post('/register', (req: Request, res: Response) => {
    const formData: RegisterForm = req.body;
    createUser(formData.username, formData.password).then(() =>
      res.redirect('/'),
    );
  });
  return router;
}
