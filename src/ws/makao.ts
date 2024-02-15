import { ServerOptions, WebSocketServer, WebSocket } from 'ws';
import cookie from 'cookie';
import { getUserFromToken } from '../models/user';

class ConnectedUser {
  name: string;
  ws: [WebSocket];
  table: Table | undefined;
  timeout: NodeJS.Timeout | undefined;

  constructor(name: string, ws: WebSocket) {
    this.name = name;
    this.ws = [ws];
  }

  toJSON() {
    return { name: this.name, table: this.table?.number };
  }
}

class Table {
  number: number;
  users: ConnectedUser[];
  constructor(number: number, user: ConnectedUser) {
    this.number = number;
    this.users = [user];
  }
  toJSON() {
    return { number: this.number, users: this.users.map((u) => u.name) };
  }
}

enum MessageKind {
  LobbyStatus = 'lobbyStatus',
  UserJoin = 'lobbyJoin',
  UserLeave = 'lobbyLeave',
  TableCreated = 'tableCreated',
  SwitchTable = 'switchTable',
  TableJoin = 'tableJoin',
  TableLeave = 'tableLeave',
  ReturnToLobby = 'returnToLobby',
  ChatMessage = 'chatMessage',
}

class Message {
  kind: MessageKind;
  data: any;

  constructor(kind: MessageKind, data: any = undefined) {
    this.kind = kind;
    this.data = data;
  }

  send(clients: WebSocket[], skip: WebSocket[] = []) {
    const json = JSON.stringify(this);
    clients.forEach((client) => {
      if (!skip.includes(client) && client.readyState === WebSocket.OPEN) {
        client.send(json);
      }
    });
  }
}

export default function MakaoServer(options: ServerOptions) {
  const wss = new WebSocketServer(options);
  const users: Map<string, ConnectedUser> = new Map();
  const tables: Map<number, Table> = new Map();

  wss.on('connection', async (ws, req) => {
    const cookies = cookie.parse(req.headers.cookie || '');
    const user = await getUserFromToken(cookies.token);
    if (!user) {
      ws.close();
      return;
    }
    let connUser = users.get(user.name)!;
    if (connUser == undefined) {
      connUser = new ConnectedUser(user.name, ws);
      users.set(user.name, connUser);
      new Message(MessageKind.UserJoin, user.name).send([...wss.clients], [ws]);
      new Message(MessageKind.LobbyStatus, {
        users: [...users.values()],
        tables: [...tables.values()],
      }).send([ws]);
    } else {
      if (connUser.timeout) {
        clearTimeout(connUser.timeout);
      }
      connUser.ws.push(ws);
      new Message(MessageKind.LobbyStatus, {
        users: [...users.values()],
        tables: [...tables.values()],
      }).send([ws]);
      if (connUser.table) {
        new Message(MessageKind.SwitchTable, connUser.table.number).send([ws]);
      }
    }

    ws.on('message', (msg) => {
      const parsedMsg = JSON.parse(msg.toString());
      switch (parsedMsg.kind) {
        case 'createTable': {
          if (connUser.table) break;

          let number;
          if (tables.size == 0) {
            number = 100;
          } else {
            const numbers = [...tables.keys()].sort();
            number = numbers[numbers.length - 1] + 1;
            for (let i = 1; i < numbers.length; i++) {
              if (numbers[i - 1] - numbers[i] < -1) {
                number = numbers[i] - 1;
                break;
              }
            }
          }
          const table = new Table(number, connUser);
          tables.set(number, table);
          connUser.table = table;
          new Message(MessageKind.TableCreated, table).send([...wss.clients]);
          new Message(MessageKind.SwitchTable, table.number).send(connUser.ws);
          break;
        }
        case 'joinTable': {
          if (connUser.table) break;

          const table = tables.get(parsedMsg.data);
          if (!table) break;

          table.users.push(connUser);
          connUser.table = table;
          new Message(MessageKind.SwitchTable, table.number).send(connUser.ws);
          new Message(MessageKind.TableJoin, {
            number: table.number,
            name: user.name,
          }).send([...wss.clients]);
          break;
        }
        case 'leaveTable': {
          const table = connUser.table;
          if (!table) break;

          table.users.splice(table.users.indexOf(connUser), 1);
          connUser.table = undefined;
          new Message(MessageKind.ReturnToLobby).send(connUser.ws);
          new Message(MessageKind.TableLeave, {
            number: table.number,
            name: user.name,
          }).send([...wss.clients]);
          break;
        }
        case 'chatMessage': {
          const table = connUser.table;
          if (!table) break;

          new Message(MessageKind.ChatMessage, {
            user: user.name,
            content: parsedMsg.data,
          }).send(table.users.map((u) => u.ws).flat());
          break;
        }
        default:
          break;
      }
    });

    ws.on('close', () => {
      connUser.ws.splice(connUser.ws.indexOf(ws), 1);
      if (connUser.ws.length > 0) return;

      connUser.timeout = setTimeout(() => {
        if (connUser.table) {
          const table = connUser.table;
          table.users.splice(table.users.indexOf(connUser), 1);
          new Message(MessageKind.TableLeave, {
            number: table.number,
            name: user.name,
          }).send([...wss.clients], [ws]);
        }
        users.delete(user.name);

        new Message(MessageKind.UserLeave, user.name).send(
          [...wss.clients],
          [ws],
        );
      }, 5000);
    });
  });

  return wss;
}
