import express, { Express } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import livereload from 'livereload';
import connectLiveReload from 'connect-livereload';
import RouteLoader from './utils/routeloader';
import cookieParser from 'cookie-parser';
import session from './middleware/session';
import { createServer } from 'http';
import WSServer from './ws/server';

dotenv.config();

const app: Express = express();
const server = createServer(app);

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

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
RouteLoader('src/routes/**/*.ts').then((routes) => app.use('/', routes));
app.use(cookieParser());
app.use(session);

const makaoServer = WSServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '', `http://${req.headers.host || ''}`);

  if (url.pathname === '/ws/makao') {
    makaoServer.handleUpgrade(req, socket, head, (ws) => {
      makaoServer.emit('connection', ws, req);
    });
  } else socket.destroy();
});

server.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
