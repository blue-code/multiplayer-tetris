const socket = io();
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const gameMessage = document.getElementById('gameMessage');
const opponentBoards = document.getElementById('opponentBoards');
const playersList = document.getElementById('playersList');  // 닉네임 목록 표시

const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = canvas.width / COLS;
let board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
let score = 0;
let gameOver = false;
let currentPiece = null;
let opponents = {};

const PIECES = [
  [[1, 1, 1, 1]], // I
  [[1, 1], [1, 1]], // O
  [[1, 1, 1], [0, 1, 0]], // T
  [[1, 1, 1], [1, 0, 0]], // L
  [[1, 1, 1], [0, 0, 1]]  // J
];

// 방 참여 (닉네임과 방 ID 전송)
document.getElementById('joinButton').addEventListener('click', () => {
  const roomId = document.getElementById('roomInput').value;
  const nickname = document.getElementById('nicknameInput').value;
  if (!nickname || !roomId) {
    alert('닉네임과 방 ID를 모두 입력하세요!');
    return;
  }
  socket.emit('joinRoom', { roomId, nickname });
});

// 게임 시작
document.getElementById('startButton').addEventListener('click', () => {
  socket.emit('startGame');
});

// 플레이어 목록 업데이트 (닉네임 표시)
socket.on('playerList', (nicknames) => {
  playersList.textContent = `접속 중: ${nicknames.join(', ')}`;
});

// 게임 시작 알림
socket.on('gameStarted', () => {
  gameMessage.textContent = '게임이 시작되었습니다!';
  startGame();
});

// 상대방 보드 업데이트
socket.on('updateOpponentBoard', (players) => {
  opponents = {};
  opponentBoards.innerHTML = '';
  players.forEach(p => {
    if (p.id !== socket.id) {
      opponents[p.id] = p;
      const oppCanvas = document.createElement('canvas');
      oppCanvas.width = 100;
      oppCanvas.height = 200;
      opponentBoards.appendChild(oppCanvas);
      renderBoard(oppCanvas.getContext('2d'), p.board, oppCanvas.width / COLS);
    }
  });
});

// 패널티 라인 추가
socket.on('addPenaltyLines', (lines) => {
  for (let i = 0; i < lines; i++) {
    board.shift();
    board.push(Array(COLS).fill(1));
  }
  render();
});

// 게임 종료
socket.on('gameEnded', (winnerNickname) => {
  gameOver = true;
  gameMessage.textContent = `게임 종료! 승자: ${winnerNickname}`;
});

function startGame() {
  currentPiece = randomPiece();
  gameOver = false;
  board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
  score = 0;
  scoreDisplay.textContent = `점수: ${score}`;
  gameLoop();
}

function gameLoop() {
  if (gameOver) return;
  moveDown();
  setTimeout(gameLoop, 500);
}

function randomPiece() {
  const piece = PIECES[Math.floor(Math.random() * PIECES.length)];
  return { shape: piece, x: Math.floor(COLS / 2) - Math.floor(piece[0].length / 2), y: 0 };
}

function moveDown() {
  if (!currentPiece) return;
  if (canMove(currentPiece.shape, currentPiece.x, currentPiece.y + 1)) {
    currentPiece.y++;
  } else {
    fixPiece();
    clearLines();
    currentPiece = randomPiece();
    if (!canMove(currentPiece.shape, currentPiece.x, currentPiece.y)) {
      gameOver = true;
      socket.emit('gameOver');
      gameMessage.textContent = '게임 오버!';
    }
  }
  render();
  socket.emit('updateBoard', { board, score, linesCleared: 0 });
}

function canMove(shape, x, y) {
  for (let i = 0; i < shape.length; i++) {
    for (let j = 0; j < shape[i].length; j++) {
      if (shape[i][j]) {
        const newX = x + j;
        const newY = y + i;
        if (newX < 0 || newX >= COLS || newY >= ROWS || (newY >= 0 && board[newY][newX])) {
          return false;
        }
      }
    }
  }
  return true;
}

function fixPiece() {
  for (let i = 0; i < currentPiece.shape.length; i++) {
    for (let j = 0; j < currentPiece.shape[i].length; j++) {
      if (currentPiece.shape[i][j]) {
        board[currentPiece.y + i][currentPiece.x + j] = 1;
      }
    }
  }
}

function clearLines() {
  let linesCleared = 0;
  for (let i = ROWS - 1; i >= 0; i--) {
    if (board[i].every(cell => cell)) {
      board.splice(i, 1);
      board.unshift(Array(COLS).fill(0));
      score += 100;
      linesCleared++;
      i++;
    }
  }
  scoreDisplay.textContent = `점수: ${score}`;
  if (linesCleared > 0) {
    socket.emit('updateBoard', { board, score, linesCleared });
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderBoard(ctx, board, BLOCK_SIZE);
  if (currentPiece) {
    renderPiece(ctx, currentPiece.shape, currentPiece.x, currentPiece.y);
  }
}

function renderBoard(context, boardData, blockSize) {
  for (let i = 0; i < ROWS; i++) {
    for (let j = 0; j < COLS; j++) {
      if (boardData[i][j]) {
        context.fillStyle = 'gray';
        context.fillRect(j * blockSize, i * blockSize, blockSize - 1, blockSize - 1);
      }
    }
  }
}

function renderPiece(context, shape, x, y) {
  context.fillStyle = 'blue';
  for (let i = 0; i < shape.length; i++) {
    for (let j = 0; j < shape[i].length; j++) {
      if (shape[i][j]) {
        context.fillRect((x + j) * BLOCK_SIZE, (y + i) * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
      }
    }
  }
}

document.addEventListener('keydown', (e) => {
  if (gameOver || !currentPiece) return;
  switch (e.key) {
    case 'ArrowLeft':
      if (canMove(currentPiece.shape, currentPiece.x - 1, currentPiece.y)) currentPiece.x--;
      break;
    case 'ArrowRight':
      if (canMove(currentPiece.shape, currentPiece.x + 1, currentPiece.y)) currentPiece.x++;
      break;
    case 'ArrowDown':
      moveDown();
      break;
    case ' ':
      while (canMove(currentPiece.shape, currentPiece.x, currentPiece.y + 1)) currentPiece.y++;
      moveDown();
      break;
  }
  render();
});