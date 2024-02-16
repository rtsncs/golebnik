const lobby = document.getElementById('lobby');
const table = document.getElementById('table');
const tableList = document.getElementById('tables');
const userList = document.getElementById('users');
const chatbox = document.getElementById('chatbox');
const users = new Map();
const tables = new Map();
let username = undefined;
let currentTable = null;

const players = document.getElementById('players');

class Table {
  constructor(id, seats = [], users) {
    this.id = id;
    this.seats = seats;
    this.users = users;
    this.listNode = document.createElement('p');
    this.listNode.textContent = '#' + this.id + ' ' + this.seats;
    this.listNode.onclick = (_e) => {
      socket.send(JSON.stringify({ type: 'joinTable', id: this.id }));
    };
    tableList.appendChild(this.listNode);
  }

  join(user) {
    this.users.push(user);
  }

  leave(user) {
    this.users.splice(this.users.indexOf(user), 1);
    const seat = this.seats.indexOf(user);
    if (seat >= 0) this.stand(seat);
  }

  sit(user, seat) {
    this.seats[seat] = user;
    this.listNode.textContent = '#' + this.id + ' ' + this.seats;
    if (currentTable != null && this == currentTable) {
      players.children[seat].textContent = user;
    }
  }

  stand(seat) {
    this.seats[seat] = undefined;
    this.listNode.textContent = '#' + this.id + ' ' + this.seats;
    if (currentTable != null && this == currentTable) {
      players.children[seat].textContent = '-';
    }
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

function switchTable(id) {
  const url = new URL(location);
  if (id == 0) {
    currentTable = undefined;
    lobby.style.display = 'block';
    table.style.display = 'none';
    url.hash = '';
  } else {
    currentTable = tables.get(id);
    lobby.style.display = 'none';
    table.style.display = 'block';
    for (let i = 0; i < currentTable.seats.length; i++) {
      players.children[i].textContent = currentTable.seats[i] || '-';
    }
    chatbox.replaceChildren([]);
    url.hash = id;
  }
  history.replaceState({}, '', url);
}

const socket = new WebSocket(`ws://${window.location.host}/ws/makao`);

socket.addEventListener('message', (e) => {
  console.log('msg from server: ', e.data);
  const msg = JSON.parse(e.data);
  switch (msg.type) {
    case 'lobbyState': {
      username = msg.username;
      msg.tables.forEach((table) => {
        tables.set(table.id, new Table(table.id, table.seats, table.users));
      });
      msg.users.forEach((user) => {
        users.set(user.name, new User(user.name, user.table));
        if (user.name === username && user.table) {
          switchTable(user.table);
        }
      });
      if (!currentTable) {
        const url = new URL(location);
        if (url.hash) {
          const id = parseInt(url.hash.substring(1));
          socket.send(JSON.stringify({ type: 'joinTable', id }));
        }
      }
      break;
    }
    case 'lobbyJoin': {
      users.set(msg.name, new User(msg.name, null));
      break;
    }
    case 'lobbyLeave': {
      const user = users.get(msg.name);
      if (user) user.delete();
      users.delete(msg.name);
      break;
    }
    case 'tableCreated': {
      tables.set(msg.id, new Table(msg.id, msg.seats, msg.users));
      if (msg.users.includes(username)) {
        switchTable(msg.id);
      }
      break;
    }
    case 'lobbyTable': {
      switchTable(msg.id);
      break;
    }
    case 'tableJoin': {
      const table = tables.get(msg.id);
      table.join(msg.user);
      if (msg.user == username) {
        switchTable(msg.id);
      }
      if (currentTable != null && table == currentTable) {
        const el = document.createElement('p');
        el.textContent = `${msg.user} dołączył`;
        chatbox.appendChild(el);
      }
      break;
    }
    case 'tableLeave': {
      const table = tables.get(msg.id);
      table.leave(msg.user);
      if (msg.user == username) {
        switchTable(0);
      }
      if (currentTable != null && table == currentTable) {
        const el = document.createElement('p');
        el.textContent = `${msg.user} odszedł`;
        chatbox.appendChild(el);
      }
      break;
    }
    case 'tableChat': {
      const el = document.createElement('p');
      el.textContent = `${msg.user}: ${msg.content}`;
      chatbox.appendChild(el);
      break;
    }
    case 'tableSit': {
      const table = tables.get(msg.id);
      table.sit(msg.user, msg.seat);
      break;
    }
    case 'tableStand': {
      const table = tables.get(msg.number);
      table.stand(msg.seat);
      break;
    }
    default:
      break;
  }
});

document.getElementById('newTable').addEventListener('click', (_e) => {
  socket.send(JSON.stringify({ type: 'createTable' }));
});

document.getElementById('leaveTable').addEventListener('click', (_e) => {
  socket.send(JSON.stringify({ type: 'leaveTable' }));
});

document.forms['chatform'].addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = e.target['message'].value;
  if (!msg) return;
  socket.send(JSON.stringify({ type: 'tableChat', content: msg }));
  e.target['message'].value = '';
});

players.childNodes.forEach((n, i) =>
  n.addEventListener('click', (_e) => {
    socket.send(JSON.stringify({ type: 'tableSit', seat: i }));
  }),
);
