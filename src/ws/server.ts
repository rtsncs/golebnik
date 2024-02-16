import { ServerOptions, WebSocketServer } from 'ws';
import cookie from 'cookie';
import { getUserFromToken } from '../models/user';
import { Lobby } from './lobby';

export default function WSServer(options: ServerOptions) {
  const wss = new WebSocketServer(options);
  const lobby = new Lobby();

  wss.on('connection', async (ws, req) => {
    const cookies = cookie.parse(req.headers.cookie || '');
    const user = await getUserFromToken(cookies.token);
    if (!user) {
      ws.close();
      return;
    }
    lobby.join(user, ws);

    ws.on('message', (msg) => {
      lobby.handleMsg(msg.toString(), user.name);
    });

    ws.on('close', () => {
      lobby.leave(user.name, ws);
    });
  });

  return wss;
}
