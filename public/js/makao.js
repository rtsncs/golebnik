console.log('elo');
const tableList = document.getElementById('tables');
const userList = document.getElementById('users');
const users = new Map();

function updateLobby(newTables, newUsers) {
  let userNodes = [];

  newUsers.forEach((user) => {
    if (!users.has(user)) {
      const node = document.createElement('p');
      node.textContent = user;
      users.set(user, node);
      userNodes.push(node);
    }
  });

  userList.replaceChildren(...userNodes);
}

const socket = new WebSocket(`ws://${window.location.host}/ws/makao`);

socket.addEventListener('open', (_e) => {
  socket.send('siemanko');
});

socket.addEventListener('message', (e) => {
  console.log('msg from server: ', e.data);
  const msg = JSON.parse(e.data);
  if (msg.kind == 'lobbyStatus') {
    updateLobby(msg.data.tables, msg.data.users);
  } else if (msg.kind == 'lobbyJoin') {
    const node = document.createElement('p');
    node.textContent = msg.data;
    userList.appendChild(node);
    users.set(msg.data, node);
  } else if (msg.kind == 'lobbyLeave') {
    const node = users.get(msg.data);
    console.log(node);
    userList.removeChild(node);
    users.delete(msg.data);
  }
});
