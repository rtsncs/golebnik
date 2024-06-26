import { Router, Request, Response } from 'express';

export default function (router: Router) {
  router.get('/', (req: Request, res: Response) => {
    res.render('index', { title: 'gry online', user: req.session });
  });
  return router;
}
