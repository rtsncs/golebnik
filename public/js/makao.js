const tableList = document.getElementById('tables');
const userList = document.getElementById('users');
const chatbox = document.getElementById('chatbox');
const players = document.getElementById('players');
const users = new Map();
const tables = new Map();
let username = undefined;
let currentTable = null;

class Table {
  constructor(id, seats = [], users, operator) {
    this.id = id;
    this.seats = seats;
    this.users = users;
    this.operator = operator;
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

  destroy() {
    this.listNode.remove();
    tables.delete(this.id);
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
    // document.getElementById('tableOp').textContent =
    //   `Operator stołu: ${currentTable.operator}`;
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
    this.turn = -1;
    this.playedCards = [];
    this.hands = [];
    this.toDraw = 0;
    this.ctx = document.getElementsByTagName('canvas').item(0).getContext('2d');
    this.cards = new Image();
    this.cards.src = 'cards.svg';
    this.winner = -1;
    this.actions = undefined;
    this.demand = undefined;
    this.toBlock = 0;
    this.blocks = [0, 0];

    this.updateSize();

    this.ctx.canvas.addEventListener('mouseup', (e) => {
      const mySeat = currentTable.seats.indexOf(username);
      const myTurn = mySeat != -1 && this.winner == -1 && mySeat == this.turn;
      if (e.button != 0 || !myTurn) return;

      const x = e.offsetX;
      const y = e.offsetY;

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
        socket.send(
          JSON.stringify({ type: 'playCard', card: this.hand[i].card }),
        );
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

  drawCard(x, y, card = 'J2', highlight = undefined) {
    const offsetX = offsetsX[card.substring(1)] * cardWidth;
    const offsetY = offsetsY[card[0]] * cardHeight;

    if (highlight === false) {
      //TODO
    }

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
    if (this.toDraw > 0) {
      ctx.fillText(`do wzięcia: ${this.toDraw}`, 0, 18);
    }
    if (this.demand) {
      let demandText = this.demand;
      if (this.demand == 'H') demandText = 'kier';
      if (this.demand == 'D') demandText = 'karo';
      if (this.demand == 'S') demandText = 'pik';
      if (this.demand == 'C') demandText = 'trefl';
      ctx.fillText(`żądanie: ${demandText}`, 0, 18);
    }
    if (this.toBlock > 0) {
      ctx.fillText(`do stracenia: ${this.toBlock}`, 0, 18);
    }

    const playedCardsWidth =
      this.width / 2 -
      this.cardGap * ((this.playedCards.length - 1) / 2) +
      this.cardGap * this.playedCards.length +
      cardWidth * this.cardScale;
    let skipPlayed = 0;
    if (playedCardsWidth > this.width) skipPlayed = 10;
    this.playedCards.forEach((card, i) => {
      if (i >= skipPlayed)
        this.drawCard(
          this.width / 2 -
            this.cardGap * ((this.playedCards.length - 1 - skipPlayed) / 2) +
            this.cardGap * (i - skipPlayed),
          this.height / 2,
          card,
        );
    });

    const mySeat = currentTable.seats.indexOf(username);
    const myTurn = mySeat != -1 && this.winner == -1 && mySeat == this.turn;

    ctx.textAlign = 'center';

    document.getElementById('passBtn').style.display = 'none';
    document.getElementById('drawBtn').style.display = 'none';
    document.getElementById('pickSuit').style.display = 'none';
    document.getElementById('pickRank').style.display = 'none';

    if (myTurn) {
      let text = [];
      if (this.actions.includes('play')) {
        text.push('rzucasz');
      }
      if (this.actions.includes('draw')) {
        text.push('bierzesz');
        document.getElementById('drawBtn').style.display = 'block';
      }
      if (this.actions.includes('suit')) {
        text.push('żądasz');
        document.getElementById('pickSuit').style.display = 'block';
      }
      if (this.actions.includes('rank')) {
        text.push('żądasz');
        document.getElementById('pickRank').style.display = 'block';
      }
      if (this.actions.includes('pass')) {
        text.push('pasujesz');
        document.getElementById('passBtn').style.display = 'block';
      }

      ctx.fillText(
        text.join(' lub '),
        this.width / 2,
        this.height - 41 - cardHeight * this.cardScale,
      );
    }

    const bottomHand = mySeat != -1 ? mySeat : 0;

    this.hands.forEach((cardsAmount, i) => {
      const name = currentTable.seats[i];
      if (name) {
        const blocked = this.blocks[i];
        const textOffset = 5 + cardHeight * this.cardScale;
        const textHeight =
          i == bottomHand ? this.height - textOffset : textOffset;
        if (i == bottomHand) ctx.textBaseline = 'bottom';
        else ctx.textBaseline = 'top';
        ctx.fillText(
          (this.turn == i ? '>' : '') +
            currentTable.seats[i] +
            (blocked ? `[${blocked}]` : '') +
            (this.turn == i ? '<' : ''),
          this.width / 2,
          textHeight,
        );
      }
      const cardsOffset = (cardHeight * this.cardScale) / 2;
      const cardsHeight =
        i == bottomHand ? this.height - cardsOffset : cardsOffset;
      if (i != mySeat) {
        for (let j = 0; j < cardsAmount; j++) {
          this.drawCard(
            this.width / 2 -
              this.cardGap * ((cardsAmount - 1) / 2) +
              this.cardGap * j,
            cardsHeight,
          );
        }
      } else {
        this.hand.forEach(({ card, playable }, i) => {
          this.drawCard(
            this.width / 2 -
              this.cardGap * ((this.hand.length - 1) / 2) +
              this.cardGap * i,
            cardsHeight,
            card,
            playable,
          );
        });
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
        tables.set(
          table.id,
          new Table(table.id, table.seats, table.users, table.operator),
        );
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
      tables.set(msg.id, new Table(msg.id, msg.seats, msg.users, msg.operator));
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
      users.get(msg.user).table = undefined;
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
      if (table == currentTable) game.draw();
      break;
    }
    case 'tableStand': {
      const table = tables.get(msg.id);
      table.stand(msg.seat);
      if (table == currentTable) game.draw();
      break;
    }
    case 'tableOperator': {
      const table = tables.get(msg.id);
      table.operator = msg.user;
      // if (table === currentTable) {
      //   document.getElementById('tableOp').textContent =
      //     `Operator stołu: ${msg.user}`;
      // }
      break;
    }
    case 'tableDestroyed': {
      const table = tables.get(msg.id);
      table.destroy();
      break;
    }
    case 'gameState': {
      game.playedCards = msg.playedCards;
      game.hands = msg.hands;
      game.hand = msg.hand;
      game.turn = msg.turn;
      game.toDraw = msg.toDraw;
      game.repeatingTurn = msg.repeatingTurn;
      game.winner = msg.winner;
      if (msg.winner != -1) {
        const el = document.createElement('p');
        el.textContent = `wygrywa ${currentTable.seats[msg.winner]}`;
        chatbox.appendChild(el);
      }
      if (msg.actions) {
        game.actions = msg.actions.split(',');
      } else game.actions = undefined;
      game.demand = msg.demand;
      game.toBlock = msg.toBlock;
      game.blocks = msg.blocks;
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

document.getElementById('drawBtn').addEventListener('click', (_e) => {
  socket.send(JSON.stringify({ type: 'drawCard' }));
});

document.getElementById('passBtn').addEventListener('click', (_e) => {
  socket.send(JSON.stringify({ type: 'pass' }));
});

document.getElementById('pickH').addEventListener('click', (_e) => {
  socket.send(JSON.stringify({ type: 'suit', suit: 'H' }));
});
document.getElementById('pickD').addEventListener('click', (_e) => {
  socket.send(JSON.stringify({ type: 'suit', suit: 'D' }));
});
document.getElementById('pickS').addEventListener('click', (_e) => {
  socket.send(JSON.stringify({ type: 'suit', suit: 'S' }));
});
document.getElementById('pickC').addEventListener('click', (_e) => {
  socket.send(JSON.stringify({ type: 'suit', suit: 'C' }));
});

{
  const buttons = document.getElementsByClassName('pickBtn');
  for (let i = 0; i < buttons.length; i++) {
    const button = buttons[i];
    button.addEventListener('click', (_e) => {
      socket.send(JSON.stringify({ type: 'rank', rank: button.textContent }));
    });
  }
}
