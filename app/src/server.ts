import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";

// --- 1. Socket.IO 서버 생성 ---
const io = new Server({
  // 특정 경로를 사용하지 않고 루트('/')에서 모든 연결을 받음
  // Nginx에서 /socket.io/ 경로를 자동으로 처리해 줌
  cors: {
    origin: "*", // 실제 운영 환경에서는 프론트엔드 도메인으로 제한하는 것이 안전
    methods: ["GET", "POST"],
  },
  allowEIO3: true, // y-webrtc 구버전 클라이언트 호환성
});

// --- 2. JWT 인증 미들웨어 ---
io.use((socket: Socket, next: (err?: Error) => void) => {
  try {
    // y-webrtc는 쿼리 파라미터로 인증 정보를 보내므로, query에서 토큰을 찾음
    const token = socket.handshake.query.token as string;

    if (!token) {
      console.error("[Auth] Connection rejected: No token provided.");
      return next(new Error("Authentication error: No token provided."));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
      email: string;
    };
    socket.data.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (err: any) {
    console.error("[Auth] Connection rejected: Invalid token.", err.message);
    return next(new Error("Authentication error: Invalid token."));
  }
});

// --- 3. Connection 이벤트 핸들러 ---
io.on("connection", (socket: Socket) => {
  const user = socket.data.user;
  console.log(`[Connection] User connected: ${user.email} (ID: ${socket.id})`);

  // --- 4. y-webrtc v13+ 표준 시그널링 이벤트 핸들러들 ---

  socket.on("y-webrtc-join", async (roomName: string) => {
    socket.join(roomName);
    console.log(`[Join] User ${user.email} joined room: ${roomName}`);

    // 현재 Room에 있는 다른 소켓들의 ID 목록을 가져옴
    const otherSockets = await io.in(roomName).fetchSockets();
    const otherPeerIds = otherSockets
      .map((s) => s.id)
      .filter((id) => id !== socket.id);

    // 요청한 클라이언트에게만 기존 피어 목록을 알려줌
    socket.emit("y-webrtc-joined", { room: roomName, peers: otherPeerIds });
    console.log(
      `[Joined] Sent peer list to ${user.email} for room ${roomName}:`,
      otherPeerIds
    );
  });

  socket.on("y-webrtc-signal", ({ to, signal }) => {
    // 특정 피어에게 시그널링 메시지 전달
    io.to(to).emit("y-webrtc-signal", { from: socket.id, signal });
  });

  socket.on("y-webrtc-awareness-update", (payload) => {
    socket.rooms.forEach((room) => {
      if (room !== socket.id) {
        // 자신을 제외한 Room의 다른 모든 피어에게 awareness 정보 브로드캐스트
        socket
          .to(room)
          .emit("y-webrtc-awareness-update", { ...payload, peerId: socket.id });
      }
    });
  });

  socket.on("disconnecting", () => {
    console.log(
      `[Disconnecting] User disconnecting: ${user.email} (ID: ${socket.id})`
    );
    socket.rooms.forEach((room) => {
      if (room !== socket.id) {
        socket.to(room).emit("y-webrtc-left", { room, peerId: socket.id });
        console.log(
          `[Left] Notified room ${room} that peer ${socket.id} has left.`
        );
      }
    });
  });

  socket.on("disconnect", (reason: string) => {
    console.log(
      `[Disconnect] User disconnected: ${user.email} (ID: ${socket.id}). Reason: ${reason}`
    );
  });
});

// --- 5. 서버 실행 ---
const PORT = process.env.PORT || 8081;
io.listen(Number(PORT));
console.log(`✅ Flamingo Signaling Server listening on port ${PORT}`);
