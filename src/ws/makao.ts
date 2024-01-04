import { ServerOptions, WebSocketServer, WebSocket } from 'ws';
import cookie from 'cookie';
import { getUserFromToken } from '../models/user';

// interface ConnectedUser {
//   name: string;
// }

interface Table {
  number: number;
  users: string[];
}

enum MessageKind {
  LobbyStatus = 'lobbyStatus',
  UserJoin = 'lobbyJoin',
  UserLeave = 'lobbyLeave',
}

class Message {
  kind: MessageKind;
  data: any;

  constructor(kind: MessageKind, data: any) {
    this.kind = kind;
    this.data = data;
  }
}

export default function MakaoServer(options: ServerOptions) {
  const wss = new WebSocketServer(options);
  const users: Set<string> = new Set();
  const tables: Table[] = [];

  wss.on('connection', async (ws, req) => {
    const cookies = cookie.parse(req.headers.cookie || '');
    const user = await getUserFromToken(cookies.token);
    if (!user) {
      ws.close();
      return;
    }
    users.add(user.name);
    ws.send(
      JSON.stringify(
        new Message(MessageKind.LobbyStatus, {
          users: Array.from(users),
          tables: tables,
        }),
      ),
    );
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify(new Message(MessageKind.UserJoin, user.name)),
        );
      }
    });

    ws.on('message', (msg) => {
      ws.send('received: ' + msg);
    });

    ws.on('close', () => {
      users.delete(user.name);
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify(new Message(MessageKind.UserLeave, user.name)),
          );
        }
      });
    });
  });

  return wss;
}
