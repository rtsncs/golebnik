import { CardGameClientMessage, Makao } from './games/game';
import { Lobby, LobbyUser } from './lobby';
import { WebSocket } from 'ws';

interface ChatMessage {
  readonly type: 'tableChat';
  content: string;
}

interface SitMessage {
  readonly type: 'tableSit';
  seat: number;
}

interface StandMessage {
  readonly type: 'tableStand';
}

export type TableClientMessage = ChatMessage | SitMessage | StandMessage;

interface ServerMessage {
  readonly type: string;
}

class ServerCreated implements ServerMessage {
  readonly type = 'tableCreated';
  id: number;
  users: string[];
  operator: string;
  constructor(id: number, users: LobbyUser[], operator: string) {
    this.id = id;
    this.users = users.map((u) => u.name);
    this.operator = operator;
  }
}

class ServerDestroyed implements ServerMessage {
  readonly type = 'tableDestroyed';
  id: number;
  constructor(id: number) {
    this.id = id;
  }
}

class ServerJoin implements ServerMessage {
  readonly type = 'tableJoin';
  id: number;
  user: string;
  constructor(id: number, user: string) {
    this.id = id;
    this.user = user;
  }
}

class ServerLeave implements ServerMessage {
  readonly type = 'tableLeave';
  id: number;
  user: string;
  constructor(id: number, user: string) {
    this.id = id;
    this.user = user;
  }
}

class ServerSit implements ServerMessage {
  readonly type = 'tableSit';
  id: number;
  user: string;
  seat: number;
  constructor(id: number, user: string, seat: number) {
    this.id = id;
    this.user = user;
    this.seat = seat;
  }
}

class ServerStand implements ServerMessage {
  readonly type = 'tableStand';
  id: number;
  seat: number;
  constructor(id: number, seat: number) {
    this.id = id;
    this.seat = seat;
  }
}

class ServerChat implements ServerMessage {
  readonly type = 'tableChat';
  user: string;
  content: string;
  constructor(user: string, content: string) {
    this.user = user;
    this.content = content;
  }
}

class ServerOperator implements ServerMessage {
  readonly type = 'tableOperator';
  id: number;
  user: string;
  constructor(id: number, user: string) {
    this.id = id;
    this.user = user;
  }
}

export class Table {
  id: number;
  users: Map<string, LobbyUser>;
  seats: (string | undefined)[] = [];
  operator: string;
  lobby: Lobby;
  game: Makao;

  get allSockets() {
    return [...this.users.values()].flatMap((u) => u.ws);
  }

  constructor(id: number, user: LobbyUser, lobby: Lobby) {
    this.id = id;
    this.users = new Map([[user.name, user]]);
    this.operator = user.name;
    this.lobby = lobby;
    this.game = new Makao(this);
    this.sendMsg(
      new ServerCreated(id, [user], this.operator),
      ...lobby.allSockets,
    );
  }

  sendMsg(msg: ServerMessage, ...sockets: WebSocket[]) {
    const json = JSON.stringify(msg);
    sockets.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(json);
    });
  }

  handleMsg(msg: TableClientMessage | CardGameClientMessage, user: string) {
    switch (msg.type) {
      case 'tableChat': {
        this.sendMsg(new ServerChat(user, msg.content), ...this.allSockets);
        break;
      }
      case 'tableSit': {
        if (!this.seats[msg.seat] && !this.seats.includes(user)) {
          this.seats[msg.seat] = user;
          this.sendMsg(
            new ServerSit(this.id, user, msg.seat),
            ...this.lobby.allSockets,
          );
        }
        break;
      }
      case 'tableStand': {
        const seat = this.seats.indexOf(user);
        if (seat >= 0) {
          this.seats[seat] = undefined;
          this.sendMsg(
            new ServerStand(this.id, seat),
            ...this.lobby.allSockets,
          );
        }
        break;
      }
      default: {
        this.game.handleMsg(msg, user);
        break;
      }
    }
  }

  join(user: LobbyUser, ws?: WebSocket) {
    if (!this.users.has(user.name)) {
      this.users.set(user.name, user);
      user.table = this.id;
      this.sendMsg(
        new ServerJoin(this.id, user.name),
        ...this.lobby.allSockets,
      );
    }
    if (ws) this.game.sendState(user.name, ws);
    else this.game.sendState(user.name, ...user.ws);
  }

  leave(user: string) {
    const tUser = this.users.get(user);
    if (tUser) {
      tUser.table = undefined;
      this.users.delete(user);
      this.sendMsg(new ServerLeave(this.id, user), ...this.lobby.allSockets);
    }

    if (this.users.size == 0) {
      this.sendMsg(new ServerDestroyed(this.id), ...this.lobby.allSockets);
      this.lobby.tables.delete(this.id);
      return;
    }

    const seat = this.seats.indexOf(user);
    if (seat >= 0) this.seats[seat] = undefined;

    if (this.operator == user) {
      const newOp = this.users.keys().next().value;
      this.operator = newOp;
      this.sendMsg(
        new ServerOperator(this.id, newOp),
        ...this.lobby.allSockets,
      );
    }
  }
}
