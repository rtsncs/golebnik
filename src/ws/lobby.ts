import { Table } from './table';
import { ClientMessage } from './message';
import { User } from '../models/user';
import { WebSocket } from 'ws';

interface JoinTableMessage {
  readonly type: 'joinTable';
  id: number;
}

interface LeaveTableMessage {
  readonly type: 'leaveTable';
}

interface CreateTableMessage {
  readonly type: 'createTable';
}

export type LobbyClientMessage =
  | CreateTableMessage
  | JoinTableMessage
  | LeaveTableMessage;

interface ServerMessage {
  readonly type: string;
}

class ServerState implements ServerMessage {
  readonly type = 'lobbyState';
  users: { name: string; table?: number }[];
  tables: { id: number; seats: (string | undefined)[]; users: string[] }[];
  username: string;
  constructor(users: LobbyUser[], tables: Table[], username: string) {
    this.users = users.map((u) => {
      return { name: u.name, table: u.table };
    });
    this.tables = tables.map((t) => {
      return {
        id: t.id,
        seats: t.seats,
        users: [...t.users.keys()],
        operator: t.operator,
      };
    });
    this.username = username;
  }
}

class ServerJoin implements ServerMessage {
  readonly type = 'lobbyJoin';
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

class ServerLeave implements ServerMessage {
  readonly type = 'lobbyLeave';
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

export class LobbyUser {
  readonly name: string;
  ws: [WebSocket];
  table?: number;
  timeout?: NodeJS.Timeout;

  constructor(name: string, ws: WebSocket) {
    this.name = name;
    this.ws = [ws];
  }

  toJSON() {
    return { name: this.name, table: this.table };
  }
}

export class Lobby {
  users: Map<string, LobbyUser> = new Map();
  tables: Map<number, Table> = new Map();

  public get allSockets() {
    return [...this.users.values()].flatMap((u) => u.ws);
  }

  sendMsg(msg: ServerMessage, ...sockets: WebSocket[]) {
    const json = JSON.stringify(msg);
    sockets.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(json);
    });
  }

  handleMsg(msgString: string, username: string) {
    // console.log(username, msgString);
    const msg: ClientMessage = JSON.parse(msgString);
    const user = this.users.get(username);
    if (!user) return;

    switch (msg.type) {
      case 'joinTable': {
        const table = this.tables.get(msg.id);
        table?.join(user);
        break;
      }
      case 'leaveTable': {
        if (user.table) {
          const table = this.tables.get(user.table);
          table?.leave(username);
        }
        break;
      }
      case 'createTable': {
        const ids = [...this.tables.keys()].sort();
        let id = (ids.at(-1) || 99) + 1;
        for (let i = 1; i < ids.length; i++) {
          if (ids[i - 1] - ids[i] < -1) {
            id = ids[i] - 1;
            break;
          }
        }

        const table = new Table(id, user, this);
        this.tables.set(id, table);
        user.table = id;
        break;
      }
      default: {
        const tableId = this.users.get(username)?.table;
        if (tableId) this.tables.get(tableId)?.handleMsg(msg, username);
      }
    }
  }

  join(user: User, ws: WebSocket) {
    this.sendMsg(
      new ServerState(
        [...this.users.values()],
        [...this.tables.values()],
        user.name,
      ),
      ws,
    );

    let lobbyUser = this.users.get(user.name);
    if (lobbyUser) {
      lobbyUser.ws.push(ws);
      if (lobbyUser.timeout) clearTimeout(lobbyUser.timeout);
      if (lobbyUser.table) {
        const table = this.tables.get(lobbyUser.table);
        table?.join(lobbyUser, ws);
      }
    } else {
      lobbyUser = new LobbyUser(user.name, ws);
      this.users.set(user.name, lobbyUser);
      this.sendMsg(new ServerJoin(user.name), ...this.allSockets);
    }
  }

  leave(user: string, ws: WebSocket) {
    const lobbyUser = this.users.get(user);
    if (lobbyUser !== undefined) {
      lobbyUser.ws.splice(lobbyUser.ws.indexOf(ws), 1);
      if (lobbyUser.ws.length > 0) return;

      lobbyUser.timeout = setTimeout(() => {
        if (lobbyUser.table) {
          const table = this.tables.get(lobbyUser.table);
          table?.leave(user);
        }
        this.users.delete(user);
        this.sendMsg(new ServerLeave(user), ...this.allSockets);
      }, 1500);
    }
  }
}
