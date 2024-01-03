import { Router, Request, Response } from 'express';

export default function (router: Router) {
  router.get('/logout', (_req: Request, res: Response) => {
    res.clearCookie('token');
    res.redirect('/');
  });
  return router;
}
