## **설치 및 실행 방법**
1. **프로젝트 폴더 생성**:
   ```
   mkdir multiplayer-tetris
   cd multiplayer-tetris
   ```

2. **Node.js 설치**: [공식 사이트](https://nodejs.org)에서 설치.

3. **의존성 설치**:
   ```
   npm init -y
   npm install express socket.io
   ```

4. **파일 구조**:
   ```
   multiplayer-tetris/
   ├── server.js
   ├── public/
   │   ├── index.html
   │   ├── styles.css
   │   └── game.js
   ```

5. **서버 실행**:
   ```
   node server.js
   ```

6. **브라우저에서 접속**: `http://localhost:3000`에 접속하여 방 ID를 입력하고 게임 시작.


---

## **사용 방법**
1. 브라우저에서 페이지를 열고, 닉네임, 방 ID를 입력한 후 "참여" 버튼을 클릭합니다.
2. 최소 2명 이상이 방에 참여하면 "게임 시작" 버튼을 클릭합니다.
3. 키보드 화살표 키로 블록을 이동하고, 스페이스바로 빠르게 떨어뜨립니다.
4. 라인을 클리어하면 상대방에게 패널티 라인이 추가됩니다.
5. 한 플레이어가 게임 오버되면 승자가 표시됩니다.