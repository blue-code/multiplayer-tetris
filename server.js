const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 정적 파일 제공 (클라이언트 HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// 게임 방 관리
const rooms = {};

io.on('connection', (socket) => {
  console.log('플레이어 접속:', socket.id);

  // 방에 참여 (닉네임과 방 ID 수신)
  socket.on('joinRoom', (data) => {
    const { roomId, nickname } = data;
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = { players: [], started: false };
    rooms[roomId].players.push({ id: socket.id, nickname, board: null, score: 0, gameOver: false, startTime: null });
    io.to(roomId).emit('playerList', rooms[roomId].players.map(p => p.nickname));
  });

  // 보드 상태 업데이트
  socket.on('updateBoard', (data) => {
    const roomId = getRoomId(socket);
    const player = rooms[roomId].players.find(p => p.id === socket.id);
    player.board = data.board;
    player.score = data.score;
    socket.to(roomId).emit('updateOpponentBoard', rooms[roomId].players);
    if (data.linesCleared > 0) {
      socket.to(roomId).emit('addPenaltyLines', data.linesCleared);
    }
  });

  // 게임 시작 요청
  socket.on('startGame', () => {
    const roomId = getRoomId(socket);
    if (!rooms[roomId].started && rooms[roomId].players.length >= 2) {
      rooms[roomId].started = true;
      const currentTime = Date.now();
      // 모든 플레이어의 시작 시간 기록
      rooms[roomId].players.forEach(player => {
        player.startTime = currentTime;
      });
      io.to(roomId).emit('gameStarted');
    }
  });

  // 게임 오버 알림
  socket.on('gameOver', () => {
    const roomId = getRoomId(socket);
    const player = rooms[roomId].players.find(p => p.id === socket.id);
    player.gameOver = true;

    // 모든 플레이어가 게임 오버되었는지 확인
    const allOver = rooms[roomId].players.every(p => p.gameOver);
    if (allOver) {
      // 승자 결정
      const winner = rooms[roomId].players.reduce((prev, curr) => {
        if (prev.score > curr.score) {
          return prev;
        } else if (prev.score < curr.score) {
          return curr;
        } else {
          // 점수가 동률이면 startTime이 더 이른 플레이어 선택
          return prev.startTime < curr.startTime ? prev : curr;
        }
      });
      io.to(roomId).emit('gameEnded', winner.nickname); // 승자 발표
    }
  });

  // 접속 해제
  socket.on('disconnect', () => {
    console.log('플레이어 접속 해제:', socket.id);
    const roomId = getRoomId(socket);
    if (rooms[roomId]) {
      rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
      if (rooms[roomId].players.length === 0) delete rooms[roomId];
      else io.to(roomId).emit('playerList', rooms[roomId].players.map(p => p.nickname));
    }
  });
});

function getRoomId(socket) {
  return Array.from(socket.rooms)[1]; // 첫 번째는 socket.id, 두 번째는 roomId
}

server.listen(3000, () => {
  console.log('서버가 3000번 포트에서 실행 중입니다.');
});