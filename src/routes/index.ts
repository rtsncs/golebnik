import { Router, Request, Response } from 'express';

export default function (router: Router) {
  router.get('/', (_req: Request, res: Response) => {
    res.render('index', { title: 'Hello' });
  });
  return router;
}
