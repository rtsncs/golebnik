import { Router, Request, Response } from 'express';

export default function (router: Router) {
  router.get('/contact', (req: Request, res: Response) => {
    res.render('contact', { title: 'kontakt', user: req.session });
  });
  return router;
}
