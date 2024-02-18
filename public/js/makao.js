const tableList = document.getElementById('tables');
const userList = document.getElementById('users');
const chatbox = document.getElementById('chatbox');
const players = document.getElementById('players');
const users = new Map();
const tables = new Map();
let username = undefined;
let currentTable = null;

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
  const lobby = document.getElementById('lobby');
  const table = document.getElementById('table');
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
    game.updateSize();
  }
  history.replaceState({}, '', url);
}

const offsetsX = {
  A: 0,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 7,
  9: 8,
  10: 9,
  J: 10,
  Q: 11,
  K: 12,
  JOKER: 0,
};
const offsetsY = {
  C: 0,
  H: 1,
  S: 2,
  D: 3,
  J: 4,
};
const cardWidth = 239.178;
const cardHeight = 333.666;

class Makao {
  constructor() {
    this.hand = [];
    this.turn = 0;
    this.playedCards = [];
    this.hands = [];
    this.ctx = document.getElementsByTagName('canvas').item(0).getContext('2d');
    this.cards = new Image();
    this.cards.src = 'cards.svg';

    this.updateSize();

    this.ctx.canvas.addEventListener('mouseup', (e) => {
      console.log(e.button);
      if (e.button === 1) {
        socket.send(JSON.stringify({ type: 'drawCard' }));
        return;
      }

      const x = e.clientX - this.ctx.canvas.offsetLeft;
      const y = e.clientY - this.ctx.canvas.offsetTop;
      const handOffset =
        this.width / 2 -
        this.cardGap * ((this.hand.length - 1) / 2) -
        (cardWidth / 2) * this.cardScale;
      if (
        x > handOffset &&
        x <
          handOffset +
            this.cardGap * (this.hand.length - 1) +
            cardWidth * this.cardScale &&
        y > this.height - cardHeight * this.cardScale
      ) {
        const i = Math.min(
          Math.floor((x - handOffset) / this.cardGap),
          this.hand.length - 1,
        );
        console.log(this.hand[i]);
        socket.send(JSON.stringify({ type: 'playCard', card: this.hand[i] }));
      }
    });
  }

  updateSize() {
    this.dpr = window.devicePixelRatio;
    const style = getComputedStyle(this.ctx.canvas.parentNode);
    this.width = parseInt(style.getPropertyValue('width'));
    this.height = parseInt(style.getPropertyValue('height'));
    this.cardScale = Math.min(
      this.width / 4 / cardHeight,
      this.height / 4 / cardHeight,
    );
    this.cardGap = cardWidth * 0.15 * this.cardScale;

    this.ctx.canvas.width = this.width * this.dpr;
    this.ctx.canvas.height = this.height * this.dpr;

    this.ctx.scale(this.dpr, this.dpr);

    this.ctx.canvas.style.width = this.width + 'px';
    this.ctx.canvas.style.height = this.height + 'px';

    if (currentTable) this.draw();
  }

  drawCard(x, y, card = 'J2') {
    const offsetX = offsetsX[card.substring(1)] * cardWidth;
    const offsetY = offsetsY[card[0]] * cardHeight;

    this.ctx.drawImage(
      this.cards,
      offsetX,
      offsetY,
      cardWidth,
      cardHeight,
      // Math.floor(x - (cardWidth * scale) / 2),
      // Math.floor(y - (cardHeight * scale) / 2),
      // Math.floor(cardWidth * scale),
      // Math.floor(cardHeight * scale),
      x - (cardWidth * this.cardScale) / 2,
      y - (cardHeight * this.cardScale) / 2,
      cardWidth * this.cardScale,
      cardHeight * this.cardScale,
    );
  }

  draw() {
    if (!this.cards.complete) {
      this.cards.addEventListener('load', this.draw);
      return;
    }
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.width, this.height);

    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`#${currentTable.id}`, 0, 0);

    this.playedCards.forEach((card, i) => {
      this.drawCard(
        this.width / 2 -
          this.cardGap * Math.floor(this.playedCards.length / 2) +
          this.cardGap * i,
        this.height / 2,
        card,
      );
    });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(
      username,
      this.width / 2,
      this.height - cardHeight * this.cardScale,
    );
    this.hand.forEach((card, i) => {
      this.drawCard(
        this.width / 2 -
          this.cardGap * ((this.hand.length - 1) / 2) +
          this.cardGap * i,
        this.height - (cardHeight / 2) * this.cardScale,
        card,
      );
    });

    const mySeat = currentTable.seats.indexOf(username);

    this.hands.forEach((cardsAmount, i) => {
      if (i != mySeat) {
        for (let j = 0; j < cardsAmount; j++) {
          this.drawCard(
            this.width / 2 -
              this.cardGap * ((cardsAmount - 1) / 2) +
              this.cardGap * j,
            (cardHeight * this.cardScale) / 2,
          );
        }
      }
    });
  }
}

const game = new Makao();
const socket = new WebSocket(`ws://${window.location.host}/ws/makao`);

addEventListener('resize', (_e) => {
  game.updateSize();
});

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
    case 'gameState': {
      game.playedCards = msg.playedCards;
      game.hands = msg.hands;
      game.hand = msg.hand;
      game.turn = msg.startingPlayer;
      game.draw();
      break;
    }
    default:
      console.log('unhandled server message', msg);
      break;
  }
});

document.getElementById('newTable').addEventListener('click', (_e) => {
  socket.send(JSON.stringify({ type: 'createTable' }));
});

document.getElementById('leaveTable').addEventListener('click', (_e) => {
  socket.send(JSON.stringify({ type: 'leaveTable' }));
});

document.getElementById('startGame').addEventListener('click', (_e) => {
  socket.send(JSON.stringify({ type: 'startGame' }));
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
