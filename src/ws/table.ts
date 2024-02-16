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
  constructor(id: number, users: LobbyUser[]) {
    this.id = id;
    this.users = users.map((u) => u.name);
  }
}

// class ServerState implements ServerMessage {
//   readonly type = 'tableState';
//   users: string[];
//   seats: string[];
//   constructor(users: LobbyUser[], seats: string[]) {
//     this.users = users.map((u) => u.name);
//     this.seats = seats;
//   }
// }

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

export class Table {
  id: number;
  users: Map<string, LobbyUser>;
  seats: (string | undefined)[] = [];
  lobby: Lobby;

  get allSockets() {
    return [...this.users.values()].flatMap((u) => u.ws);
  }

  constructor(id: number, user: LobbyUser, lobby: Lobby) {
    this.id = id;
    this.users = new Map([[user.name, user]]);
    this.lobby = lobby;
    this.sendMsg(new ServerCreated(id, [user]), ...lobby.allSockets);
  }

  sendMsg(msg: ServerMessage, ...sockets: WebSocket[]) {
    const json = JSON.stringify(msg);
    sockets.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(json);
    });
  }

  handleMsg(msg: TableClientMessage, user: string) {
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
      }
    }
  }

  join(user: LobbyUser) {
    this.users.set(user.name, user);
    user.table = this.id;
    this.sendMsg(new ServerJoin(this.id, user.name), ...this.lobby.allSockets);
  }

  leave(user: string) {
    const seat = this.seats.indexOf(user);
    if (seat >= 0) this.seats[seat] = undefined;
    const tUser = this.users.get(user);
    if (tUser) {
      tUser.table = undefined;
      this.users.delete(user);
      this.sendMsg(new ServerLeave(this.id, user), ...this.lobby.allSockets);
    }
  }
}
