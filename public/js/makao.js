const lobby = document.getElementById('lobby');
const table = document.getElementById('table');
const tableList = document.getElementById('tables');
const userList = document.getElementById('users');
const chatbox = document.getElementById('chatbox');
const users = new Map();
const tables = new Map();
let currentTable = null;

const players = document.getElementById('players');

class Message {
  constructor(kind, data) {
    this.kind = kind;
    this.data = data;
  }
}

class Table {
  constructor(number, users) {
    this.number = number;
    this.users = users;
    this.listNode = document.createElement('p');
    this.listNode.textContent = '#' + this.number + ' ' + this.users;
    this.listNode.onclick = (_e) => {
      socket.send(JSON.stringify(new Message('joinTable', this.number)));
    };
    tableList.appendChild(this.listNode);
  }

  userJoin(name) {
    this.users.push(name);
    this.listNode.textContent = '#' + this.number + ' ' + this.users;
  }

  userLeave(name) {
    this.users.splice(this.users.indexOf(name), 1);
    this.listNode.textContent = this.number + ' ' + this.users;
  }
}

class User {
  constructor(name, table) {
    this.name = name;
    this.table = table;
    this.listNode = document.createElement('p');
    this.listNode.textContent = `${this.name} ${
      this.table ? '#' + this.table : ''
    }`;
    userList.appendChild(this.listNode);
  }

  delete() {
    this.listNode.remove();
  }
}

const socket = new WebSocket(`ws://${window.location.host}/ws/makao`);

socket.addEventListener('message', (e) => {
  console.log('msg from server: ', e.data);
  const msg = JSON.parse(e.data);
  switch (msg.kind) {
    case 'lobbyStatus':
      msg.data.users.forEach((user) => {
        users.set(user.name, new User(user.name, user.table));
      });
      msg.data.tables.forEach((table) => {
        tables.set(table.number, new Table(table.number, table.users));
      });

      const url = new URL(location);
      if (url.hash) {
        const number = parseInt(url.hash.substring(1));
        socket.send(JSON.stringify(new Message('joinTable', number)));
      }

      break;
    case 'lobbyJoin': {
      users.set(msg.data, new User(msg.data, null));
      break;
    }
    case 'lobbyLeave': {
      const user = users.get(msg.data);
      if (user) user.delete();
      users.delete(msg.data);
      break;
    }
    case 'tableCreated': {
      tables.set(msg.data.number, new Table(msg.data.number, msg.data.users));
      break;
    }
    case 'switchTable': {
      currentTable = tables.get(msg.data);
      lobby.style.display = 'none';
      table.style.display = 'block';
      for (let i = 0; i < currentTable.users.length; i++) {
        players.children[i].textContent = currentTable.users[i];
      }
      chatbox.replaceChildren([]);
      const url = new URL(location);
      url.hash = msg.data;
      history.replaceState({}, '', url);
      break;
    }
    case 'returnToLobby': {
      currentTable = null;
      lobby.style.display = 'block';
      table.style.display = 'none';
      const url = new URL(location);
      url.hash = '';
      history.replaceState({}, '', url);
      break;
    }
    case 'tableJoin': {
      const table = tables.get(msg.data.number);
      table.userJoin(msg.data.name);
      if (currentTable != null && table == currentTable) {
        for (let i = 0; i < players.children.length; i++) {
          players.children[i].textContent = currentTable.users[i] || '-';
        }
        const el = document.createElement('p');
        el.textContent = `${msg.data.name} dołączył`;
        chatbox.appendChild(el);
      }
      break;
    }
    case 'tableLeave': {
      const table = tables.get(msg.data.number);
      table.userLeave(msg.data.name);
      if (currentTable != null && table == currentTable) {
        for (let i = 0; i < players.children.length; i++) {
          players.children[i].textContent = currentTable.users[i] || '-';
        }
        const el = document.createElement('p');
        el.textContent = `${msg.data.name} odszedł`;
        chatbox.appendChild(el);
      }
      break;
    }
    case 'chatMessage': {
      const el = document.createElement('p');
      el.textContent = `${msg.data.user}: ${msg.data.content}`;
      chatbox.appendChild(el);
    }
    default:
      break;
  }
});

document.getElementById('newTable').addEventListener('click', (_e) => {
  socket.send(JSON.stringify(new Message('createTable')));
});

document.getElementById('leaveTable').addEventListener('click', (_e) => {
  socket.send(JSON.stringify(new Message('leaveTable')));
});

document.forms['chatform'].addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = e.target['message'].value;
  if (!msg) return;
  socket.send(JSON.stringify(new Message('chatMessage', msg)));
  e.target['message'].value = '';
});
