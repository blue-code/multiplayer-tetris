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
const rooms = {
  main: { 
    players: [], 
    started: false,
    options: null,
    createdAt: new Date()
  }
};

io.on('connection', (socket) => {
  console.log('플레이어 접속:', socket.id);

  // 방에 참여
  socket.on('joinRoom', (data) => {
    try {
      const { roomId = 'main', nickname = '익명' } = data;
      
      // 이미 게임이 시작된 방인지 확인
      if (rooms[roomId] && rooms[roomId].started) {
        socket.emit('error', { message: '이미 게임이 시작된 방입니다.' });
        return;
      }
      
      socket.join(roomId);
      
      // 방이 없으면 생성
      if (!rooms[roomId]) {
        rooms[roomId] = { 
          players: [], 
          started: false,
          options: null,
          createdAt: new Date()
        };
      }
      
      // 플레이어 추가
      rooms[roomId].players.push({
        id: socket.id,
        nickname: nickname,
        board: null,
        score: 0,
        gameOver: false,
        level: 1,
        joinedAt: new Date()
      });
      
      // 플레이어 목록 전송
      io.to(roomId).emit('playerList', rooms[roomId].players);
      
      // 방 정보 전송
      io.to(roomId).emit('roomInfo', {
        roomId: roomId,
        playerCount: rooms[roomId].players.length
      });
      
      console.log(`플레이어 ${nickname}(${socket.id})가 방 ${roomId}에 참여했습니다.`);
      
    } catch (error) {
      console.error('방 참여 오류:', error);
      socket.emit('error', { message: '방 참여 중 오류가 발생했습니다.' });
    }
  });

  // 보드 상태 업데이트
  socket.on('updateBoard', (data) => {
    try {
      const roomId = getRoomId(socket);
      if (!roomId || !rooms[roomId]) return;
      
      const player = rooms[roomId].players.find(p => p.id === socket.id);
      if (!player) return;
      
      // 플레이어 상태 업데이트
      player.board = data.board;
      player.score = data.score;
      player.level = data.level || 1;
      
      // 상대방들에게 업데이트된 보드 전송
      socket.to(roomId).emit('updateOpponentBoard', rooms[roomId].players);
      
      // 라인 클리어 시 패널티 부여
      if (data.linesCleared > 0 && data.penalty !== false) {
        socket.to(roomId).emit('addPenaltyLines', {
          lines: data.linesCleared,
          from: player.nickname
        });
      }
    } catch (error) {
      console.error('보드 업데이트 오류:', error);
    }
  });

  // 게임 시작 요청
  socket.on('startGame', (options) => {
    try {
      const roomId = getRoomId(socket);
      if (!roomId || !rooms[roomId]) return;
      
      // 최소 2명 이상일 때만 게임 시작
      if (!rooms[roomId].started && rooms[roomId].players.length >= 2) {
        rooms[roomId].started = true;
        rooms[roomId].options = options;
        rooms[roomId].startedAt = new Date();
        
        // 모든 플레이어에게 게임 시작 및 옵션 전송
        io.to(roomId).emit('gameStarted', options);
        console.log(`방 ${roomId} 게임 시작. 옵션:`, options);
      } else if (rooms[roomId].players.length < 2) {
        // 플레이어가 부족할 경우 메시지 전송
        socket.emit('error', { message: '게임 시작을 위해서는 최소 2명의 플레이어가 필요합니다.' });
      }
    } catch (error) {
      console.error('게임 시작 오류:', error);
      socket.emit('error', { message: '게임 시작 중 오류가 발생했습니다.' });
    }
  });

  // 게임 오버 알림
  socket.on('gameOver', () => {
    try {
      const roomId = getRoomId(socket);
      if (!roomId || !rooms[roomId]) return;
      
      const player = rooms[roomId].players.find(p => p.id === socket.id);
      if (!player) return;
      
      player.gameOver = true;
      player.gameOverAt = new Date();
      
      // 모든 플레이어가 게임 오버인지 확인
      const allOver = rooms[roomId].players.every(p => p.gameOver);
      if (allOver) {
        // 가장 높은 점수를 가진 플레이어가 승자
        const winner = rooms[roomId].players.reduce((prev, curr) => 
          prev.score > curr.score ? prev : curr);
        
        io.to(roomId).emit('gameEnded', {
          winnerId: winner.id,
          winnerNickname: winner.nickname
        });
        
        console.log(`방 ${roomId} 게임 종료. 승자: ${winner.nickname}(${winner.id})`);
        
        // 게임 상태 초기화
        rooms[roomId].started = false;
        rooms[roomId].options = null;
        rooms[roomId].players.forEach(p => {
          p.gameOver = false;
          p.board = null;
          p.score = 0;
          p.level = 1;
        });
      }
    } catch (error) {
      console.error('게임 오버 처리 오류:', error);
    }
  });

  // 접속 해제
  socket.on('disconnect', () => {
    console.log('플레이어 접속 해제:', socket.id);
    
    try {
      const roomId = getRoomId(socket);
      if (!roomId || !rooms[roomId]) return;
      
      // 플레이어 찾기
      const playerIndex = rooms[roomId].players.findIndex(p => p.id === socket.id);
      if (playerIndex === -1) return;
      
      // 플레이어 정보 저장
      const player = rooms[roomId].players[playerIndex];
      console.log(`플레이어 ${player.nickname}(${socket.id})가 방 ${roomId}에서 나갔습니다.`);
      
      // 플레이어 제거
      rooms[roomId].players.splice(playerIndex, 1);
      
      // 방에 플레이어가 남아있지 않으면 방 삭제 (메인 방은 제외)
      if (rooms[roomId].players.length === 0 && roomId !== 'main') {
        delete rooms[roomId];
        console.log(`방 ${roomId} 삭제됨 (플레이어 없음)`);
      } else {
        // 나머지 플레이어들에게 업데이트된 플레이어 목록 전송
        io.to(roomId).emit('playerList', rooms[roomId].players);
        
        // 방 정보 업데이트
        io.to(roomId).emit('roomInfo', {
          roomId: roomId,
          playerCount: rooms[roomId].players.length
        });
        
        // 게임 중이었다면, 한 플레이어만 남았을 경우 해당 플레이어 승리 처리
        if (rooms[roomId].started && rooms[roomId].players.length === 1) {
          const lastPlayer = rooms[roomId].players[0];
          io.to(roomId).emit('gameEnded', {
            winnerId: lastPlayer.id,
            winnerNickname: lastPlayer.nickname
          });
          
          rooms[roomId].started = false;
          rooms[roomId].options = null;
          lastPlayer.gameOver = false;
          lastPlayer.board = null;
          lastPlayer.score = 0;
          lastPlayer.level = 1;
        }
      }
    } catch (error) {
      console.error('접속 해제 처리 오류:', error);
    }
  });
  
  // 에러 처리
  socket.on('error', (error) => {
    console.error('소켓 에러:', error);
  });
});

// 클라이언트가 참여한 방 ID 가져오기
function getRoomId(socket) {
  const rooms = Array.from(socket.rooms);
  return rooms.length > 1 ? rooms[1] : null; // 첫 번째는 socket.id, 두 번째는 roomId
}

// 오래된 방 정리 (30분마다)
setInterval(() => {
  const now = new Date();
  Object.keys(rooms).forEach(roomId => {
    // 메인 방은 삭제하지 않음
    if (roomId === 'main') return;
    
    // 1시간 이상 지난 방 삭제
    if ((now - rooms[roomId].createdAt) > 3600000) {
      io.to(roomId).emit('error', { message: '방이 오래되어 자동으로 삭제되었습니다.' });
      delete rooms[roomId];
      console.log(`방 ${roomId} 삭제됨 (오래됨)`);
    }
  });
}, 1800000);

server.listen(3000, () => {
  console.log('서버가 3000번 포트에서 실행 중입니다.');
});