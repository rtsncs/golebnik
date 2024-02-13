import { Router, Request, Response } from 'express';

export default function (router: Router) {
  router.get('/makao', (req: Request, res: Response) => {
    if (!req.session) res.redirect('/login?callback=makao');
    res.render('makao', { title: 'Makao', user: req.session });
  });
  return router;
}
