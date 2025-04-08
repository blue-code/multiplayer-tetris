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
