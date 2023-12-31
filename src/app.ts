import express, { Express } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import livereload from 'livereload';
import connectLiveReload from 'connect-livereload';
import RouteLoader from './routeloader';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production') {
  const liveReloadServer = livereload.createServer({ extraExts: ['pug'] });
  liveReloadServer.watch(path.join(__dirname, '../public'));
  liveReloadServer.watch(path.join(__dirname, 'views'));
  liveReloadServer.server.once('connection', () => {
    setTimeout(() => {
      liveReloadServer.refresh('/');
    }, 100);
  });
  app.use(connectLiveReload({ port: 35729 }));
}

app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'pug');

app.use(express.static(path.join(__dirname, '../public')));
RouteLoader('src/routes/**/*.ts').then((routes) => app.use('/', routes));

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
