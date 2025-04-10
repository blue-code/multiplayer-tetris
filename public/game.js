const socket = io();
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const levelDisplay = document.getElementById('level');
const gameMessage = document.getElementById('gameMessage');
const opponentBoards = document.getElementById('opponentBoards');
const playersList = document.getElementById('players');
const roomInfo = document.getElementById('roomInfo');
const joinButton = document.getElementById('joinButton');
const startButton = document.getElementById('startButton');
const nicknameInput = document.getElementById('nicknameInput');
const welcomeScreen = document.getElementById('welcomeScreen');
const gameScreen = document.getElementById('gameScreen');
const settingsPanel = document.getElementById('settingsPanel');
const rotationOption = document.getElementById('rotationOption');
const penaltyOption = document.getElementById('penaltyOption');
const difficultyOption = document.getElementById('difficultyOption');
const speedIncreaseTime = document.getElementById('speedIncreaseTime');

const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = canvas.width / COLS;
let board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
let score = 0;
let level = 1;
let gameOver = false;
let currentPiece = null;
let opponents = {};
let gameSpeed = 500; // 초기 속도 (ms)
let difficultyTimer = null;
let playerNickname = '';
let currentRoomId = null;
let gameStarted = false;
let gameOptions = {};

// 난이도별 초기 속도 설정
const DIFFICULTY_SPEEDS = {
  easy: 600,
  normal: 500,
  hard: 300
};

// 난이도별 속도 증가율
const DIFFICULTY_INCREASE = {
  easy: 50,
  normal: 75,
  hard: 100
};

// 개선안: PIECES 배열에 누락된 조각 추가
const PIECES = [
  [[1, 1, 1, 1]], // I
  [[1, 1], [1, 1]], // O
  [[1, 1, 1], [0, 1, 0]], // T
  [[1, 1, 1], [1, 0, 0]], // L
  [[1, 1, 1], [0, 0, 1]], // J
  [[0, 1, 1], [1, 1, 0]], // S (추가)
  [[1, 1, 0], [0, 1, 1]]  // Z (추가)
];

// 닉네임 입력 후 게임 참여
joinButton.addEventListener('click', () => {
  const nickname = nicknameInput.value.trim();
  if (!nickname) {
    alert('닉네임을 입력해주세요.');
    return;
  }
  
  playerNickname = nickname;
  
  // 기본 방 "main"으로 자동 입장
  const defaultRoom = "main";
  socket.emit('joinRoom', { roomId: defaultRoom, nickname: playerNickname });
  
  // 환영 화면 숨기고, 게임 로비 화면 표시
  welcomeScreen.style.display = 'none';
  gameScreen.style.display = 'block';
  
  // 설정 패널 표시
  settingsPanel.classList.remove('hidden');
  
  gameMessage.textContent = '게임 방에 입장했습니다. 다른 플레이어를 기다리는 중...';
});

// 게임 시작 버튼
startButton.addEventListener('click', () => {
  // 게임 옵션 수집
  gameOptions = {
    rotation: rotationOption.checked,
    penalty: penaltyOption.checked,
    difficulty: difficultyOption.value,
    speedIncreaseInterval: parseInt(speedIncreaseTime.value) * 1000 // 밀리초로 변환
  };
  
  // 서버에 게임 시작 요청 및 옵션 전송
  socket.emit('startGame', gameOptions);
});

// 플레이어 목록 업데이트
socket.on('playerList', (players) => {
  playersList.innerHTML = '';
  
  if (players.length === 0) {
    playersList.textContent = '접속 중인 플레이어가 없습니다.';
    return;
  }
  
  players.forEach(player => {
    const playerItem = document.createElement('div');
    playerItem.className = 'player-item';
    if (player.id === socket.id) {
      playerItem.classList.add('me');
      playerItem.textContent = `${player.nickname} (나)`;
    } else {
      playerItem.textContent = player.nickname;
    }
    playersList.appendChild(playerItem);
  });
  
  // 최소 2명 이상이면 게임 시작 버튼 활성화
  startButton.disabled = players.length < 2 || gameStarted;
  
  if (players.length < 2 && !gameStarted) {
    gameMessage.textContent = '게임 시작을 위해 최소 2명의 플레이어가 필요합니다.';
  } else if (!gameStarted) {
    gameMessage.textContent = '게임을 시작할 수 있습니다!';
  }
});

// 방 정보 업데이트
socket.on('roomInfo', (info) => {
  currentRoomId = info.roomId;
  roomInfo.textContent = `방: ${info.roomId} (${info.playerCount}명 접속 중)`;
});

// 게임 시작 알림
socket.on('gameStarted', (options) => {
  gameMessage.textContent = '게임이 시작되었습니다!';
  gameStarted = true;
  
  // 게임 시작 후 설정 패널 숨기기
  settingsPanel.classList.add('hidden');
  
  // 시작 버튼 비활성화
  startButton.disabled = true;
  
  // 기존 옵션과 서버에서 받은 옵션 병합
  gameOptions = {...gameOptions, ...options};
  
  // 게임 시작
  startGame();
});

// 상대방 보드 업데이트
socket.on('updateOpponentBoard', (players) => {
  opponents = {};
  opponentBoards.innerHTML = '';
  
  players.forEach(p => {
    if (p.id !== socket.id) {
      opponents[p.id] = p;
      
      // 상대방 정보 컨테이너
      const oppContainer = document.createElement('div');
      oppContainer.className = 'opponent-container';
      
      // 상대방 캔버스
      const oppCanvas = document.createElement('canvas');
      oppCanvas.width = 100;
      oppCanvas.height = 200;
      oppCanvas.className = 'opponent-canvas';
      
      // 상대방 정보 표시
      const oppInfo = document.createElement('div');
      oppInfo.className = 'opponent-info';
      oppInfo.innerHTML = `
        <div>${p.nickname || '익명'}</div>
        <div>점수: ${p.score || 0}</div>
        <div>레벨: ${p.level || 1}</div>
      `;
      
      oppContainer.appendChild(oppCanvas);
      oppContainer.appendChild(oppInfo);
      opponentBoards.appendChild(oppContainer);
      
      // 상대방 보드 렌더링
      renderBoard(oppCanvas.getContext('2d'), p.board, oppCanvas.width / COLS);
    }
  });
});

// 패널티 라인 추가
socket.on('addPenaltyLines', (data) => {
  // 패널티 옵션이 꺼져있으면 무시
  if (!gameOptions.penalty) return;

  const lines = data.lines;
  const fromNickname = data.from;
  
  for (let i = 0; i < lines; i++) {
    board.shift();
    const penaltyLine = Array(COLS).fill(1);
    // 랜덤 위치에 한 칸 비움
    penaltyLine[Math.floor(Math.random() * COLS)] = 0;
    board.push(penaltyLine);
  }
  render();
  
  // 패널티 알림
  gameMessage.textContent = `${fromNickname}님이 라인 클리어! ${lines}줄의 패널티가 추가되었습니다!`;
  setTimeout(() => {
    if (!gameOver) gameMessage.textContent = '';
  }, 2000);
});

// 게임 종료
socket.on('gameEnded', (data) => {
  gameOver = true;
  gameStarted = false;
  clearInterval(difficultyTimer);
  
  // 승자가 자신인지 확인
  const isWinner = data.winnerId === socket.id;
  const winnerNickname = data.winnerNickname || '알 수 없음';
  
  const winnerMessage = isWinner ? 
    '축하합니다! 게임에서 승리했습니다!' : 
    `게임 종료! 승자: ${winnerNickname}`;
  
  gameMessage.textContent = winnerMessage;
  
  // 게임 종료 후 설정 패널 다시 표시하고 시작 버튼 활성화
  setTimeout(() => {
    settingsPanel.classList.remove('hidden');
    startButton.disabled = false;
  }, 1000);
});

// 에러 메시지
socket.on('error', (data) => {
  gameMessage.textContent = data.message;
});

function startGame() {
  // 난이도에 따른 초기 속도 설정
  gameSpeed = DIFFICULTY_SPEEDS[gameOptions.difficulty];
  
  // 게임 상태 초기화
  currentPiece = randomPiece();
  gameOver = false;
  board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
  score = 0;
  level = 1;
  
  // UI 업데이트
  scoreDisplay.textContent = `점수: ${score}`;
  levelDisplay.textContent = `레벨: ${level}`;
  
  // 난이도 증가 타이머 설정
  clearInterval(difficultyTimer);
  difficultyTimer = setInterval(() => {
    if (!gameOver) {
      increaseLevel(gameOptions.difficulty);
    }
  }, gameOptions.speedIncreaseInterval);
  
  // 게임 루프 시작
  gameLoop();
}

function increaseLevel(difficulty) {
  level++;
  levelDisplay.textContent = `레벨: ${level}`;
  
  // 난이도에 따른 속도 증가
  gameSpeed = Math.max(100, gameSpeed - DIFFICULTY_INCREASE[difficulty]);
  
  // 레벨 증가 알림
  gameMessage.textContent = `레벨 ${level}! 속도 증가!`;
  setTimeout(() => {
    if (!gameOver) gameMessage.textContent = '';
  }, 2000);
  
  // 서버에 레벨 정보 업데이트
  socket.emit('updateBoard', { board, score, linesCleared: 0, level });
}

function gameLoop() {
  if (gameOver) return;
  moveDown();
  setTimeout(gameLoop, gameSpeed);
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
      gameStarted = false;
      clearInterval(difficultyTimer);
      socket.emit('gameOver');
      gameMessage.textContent = '게임 오버!';
    }
  }
  render();
  socket.emit('updateBoard', { board, score, linesCleared: 0, level });
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

function rotatePiece() {
  // 회전 옵션이 꺼져있으면 무시
  if (!gameOptions.rotation) return;
  
  const rotated = [];
  for (let i = 0; i < currentPiece.shape[0].length; i++) {
    rotated.push([]);
    for (let j = currentPiece.shape.length - 1; j >= 0; j--) {
      rotated[i].push(currentPiece.shape[j][i]);
    }
  }
  
  // 회전 가능한지 확인
  if (canMove(rotated, currentPiece.x, currentPiece.y)) {
    currentPiece.shape = rotated;
    return;
  }
  
  // 벽 근처에서 회전이 안될 경우 약간 이동하여 재시도
  const offsets = [-1, 1, -2, 2]; // 왼쪽, 오른쪽으로 시도
  for (let offset of offsets) {
    if (canMove(rotated, currentPiece.x + offset, currentPiece.y)) {
      currentPiece.shape = rotated;
      currentPiece.x += offset;
      return;
    }
  }
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
      score += 100 * level; // 레벨에 비례하여 점수 증가
      linesCleared++;
      i++;
    }
  }
  
  if (linesCleared > 0) {
    scoreDisplay.textContent = `점수: ${score}`;
    socket.emit('updateBoard', { 
      board, 
      score, 
      linesCleared,
      level,
      nickname: playerNickname,
      penalty: gameOptions.penalty // 패널티 옵션 전송
    });
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 그리드 그리기
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.5;
  
  for (let i = 0; i <= ROWS; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * BLOCK_SIZE);
    ctx.lineTo(canvas.width, i * BLOCK_SIZE);
    ctx.stroke();
  }
  
  for (let j = 0; j <= COLS; j++) {
    ctx.beginPath();
    ctx.moveTo(j * BLOCK_SIZE, 0);
    ctx.lineTo(j * BLOCK_SIZE, canvas.height);
    ctx.stroke();
  }
  
  // 보드 그리기
  renderBoard(ctx, board, BLOCK_SIZE);
  
  // 현재 조각 그리기
  if (currentPiece) {
    renderPiece(ctx, currentPiece.shape, currentPiece.x, currentPiece.y);
  }
}

function renderBoard(context, boardData, blockSize) {
  if (!boardData) return;
  
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

// 방향키 이벤트 처리 개선 - preventDefault 추가하여 스크롤 방지
document.addEventListener('keydown', (e) => {
  if (gameOver || !currentPiece || !gameStarted) return;
  
  // 게임 컨트롤에 사용되는 키는 기본 동작 방지
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }
  
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
    case 'ArrowUp':
      rotatePiece(); // 회전 함수 호출
      break;
    case ' ':
      while (canMove(currentPiece.shape, currentPiece.x, currentPiece.y + 1)) currentPiece.y++;
      moveDown();
      break;
  }
  render();
});

// 모바일 터치 컨트롤 추가
if ('ontouchstart' in window) {
  addTouchControls();
}

function addTouchControls() {
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'touch-controls';
  
  const leftBtn = document.createElement('button');
  leftBtn.textContent = '←';
  leftBtn.addEventListener('click', () => {
    if (!gameOver && currentPiece && gameStarted && 
        canMove(currentPiece.shape, currentPiece.x - 1, currentPiece.y)) {
      currentPiece.x--;
      render();
    }
  });
  
  const rightBtn = document.createElement('button');
  rightBtn.textContent = '→';
  rightBtn.addEventListener('click', () => {
    if (!gameOver && currentPiece && gameStarted && 
        canMove(currentPiece.shape, currentPiece.x + 1, currentPiece.y)) {
      currentPiece.x++;
      render();
    }
  });
  
  const downBtn = document.createElement('button');
  downBtn.textContent = '↓';
  downBtn.addEventListener('click', () => {
    if (!gameOver && currentPiece && gameStarted) {
      moveDown();
    }
  });
  
  const rotateBtn = document.createElement('button');
  rotateBtn.textContent = '↻';
  rotateBtn.addEventListener('click', () => {
    if (!gameOver && currentPiece && gameStarted) {
      rotatePiece();
      render();
    }
  });
  
  const dropBtn = document.createElement('button');
  dropBtn.textContent = '⬇︎';
  dropBtn.addEventListener('click', () => {
    if (!gameOver && currentPiece && gameStarted) {
      while (canMove(currentPiece.shape, currentPiece.x, currentPiece.y + 1)) currentPiece.y++;
      moveDown();
    }
  });
  
  controlsDiv.appendChild(leftBtn);
  controlsDiv.appendChild(downBtn);
  controlsDiv.appendChild(rotateBtn);
  controlsDiv.appendChild(rightBtn);
  controlsDiv.appendChild(dropBtn);
  
  document.querySelector('.my-board').appendChild(controlsDiv);
}

// 페이지 로드 시 포커스 설정과 터치 이벤트 제어
window.addEventListener('load', () => {
  nicknameInput.focus();
  
  // 메타 태그 업데이트 - 확대/축소 방지
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (viewportMeta) {
    viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
  }
  
  // 모바일 환경인 경우 터치 이벤트 제어
  if ('ontouchstart' in window) {
    setupTouchControls();
  }
});

// 모바일 터치 이벤트 최적화
function setupTouchControls() {
  // 문서 전체에 확대/축소 방지 이벤트 리스너 추가
  document.addEventListener('touchmove', function(event) {
    // 닉네임 입력 필드는 기본 동작 유지 - 터치 처리에서 제외
    if (event.target.id === 'nicknameInput' || event.target.tagName === 'INPUT') {
      return;
    }
    
    // 게임 진행 중이거나 인풋 필드가 아닌 경우에만 확대/축소 방지
    if (event.scale !== 1) {
      event.preventDefault();
    }
  }, { passive: false });
  
  // 더블 탭으로 인한 확대 방지
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function(event) {
    // 닉네임 입력 필드와 버튼은 기본 동작 유지
    if (event.target.id === 'nicknameInput' || 
        event.target.id === 'joinButton' || 
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'BUTTON') {
      return;
    }
    
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
  
  // iOS에서의 확대/축소 제스처 방지
  document.addEventListener('gesturestart', function(e) {
    // 닉네임 입력 필드는 기본 동작 유지
    if (e.target.id === 'nicknameInput' || 
        e.target.tagName === 'INPUT') {
      return;
    }
    e.preventDefault();
  }, { passive: false });
  
  // 게임 영역의 핀치 줌 방지
  const gameContainer = document.querySelector('.game-area-container');
  if (gameContainer) {
    gameContainer.addEventListener('touchstart', function(e) {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });
  }
  
  // 게임 영역과 컨트롤 영역만 제어
  const gameScreen = document.getElementById('gameScreen');
  if (gameScreen) {
    gameScreen.addEventListener('touchstart', function(e) {
      // 입력 필드나 버튼은 기본 동작 유지
      if (e.target.tagName === 'INPUT' || 
          e.target.tagName === 'BUTTON' || 
          e.target.id === 'nicknameInput' ||
          e.target.id === 'joinButton') {
        return;
      }
    }, { passive: true });
  }
  
  // 게임 컨트롤 버튼에 대한 터치 이벤트 처리
  const gameControlButtons = document.querySelectorAll('.touch-controls button');
  gameControlButtons.forEach(button => {
    button.addEventListener('touchstart', function(e) {
      e.preventDefault();
      this.click();
    }, { passive: false });
    
    button.addEventListener('touchend', function(e) {
      e.preventDefault();
    }, { passive: false });
  });
}