import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { URL } from "url";
import * as map from "lib0/map";
import * as jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;
const pingTimeout = 30000;

const PORT = process.env.PORT || 8081;
// topics: key는 room 이름(topic), value는 해당 room에 있는 WebSocket 클라이언트 Set
const topics = new Map<string, Set<WebSocket>>();

const server = http.createServer((request, response) => {
  response.writeHead(200, { "Content-Type": "text/plain" });
  response.end("okay");
});

const wss = new WebSocketServer({ noServer: true });

const send = (conn: WebSocket, message: object) => {
  if (
    conn.readyState !== wsReadyStateConnecting &&
    conn.readyState !== wsReadyStateOpen
  ) {
    conn.close();
  }
  try {
    conn.send(JSON.stringify(message));
  } catch (e) {
    conn.close();
  }
};

wss.on("connection", (conn: WebSocket, req) => {
  console.log(`[Connection] User connected: ${(conn as any).user.email}`);
  const subscribedTopics = new Set<string>();
  let closed = false;

  let pongReceived = true;
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      conn.close();
      clearInterval(pingInterval);
    } else {
      pongReceived = false;
      try {
        conn.ping();
      } catch (e) {
        conn.close();
      }
    }
  }, pingTimeout);

  conn.on("pong", () => {
    pongReceived = true;
  });

  conn.on("close", () => {
    subscribedTopics.forEach((topicName) => {
      const subs = topics.get(topicName) || new Set();
      subs.delete(conn);
      if (subs.size === 0) {
        topics.delete(topicName);
      }
    });
    subscribedTopics.clear();
    closed = true;
    console.log(`[Disconnect] User disconnected: ${(conn as any).user.email}`);
  });

  conn.on("message", (message: Buffer | string) => {
    const messageData = JSON.parse(message.toString());

    if (messageData && messageData.type && !closed) {
      switch (messageData.type) {
        case "subscribe":
          (messageData.topics || []).forEach((topicName: string) => {
            if (typeof topicName === "string") {
              const topic = map.setIfUndefined(
                topics,
                topicName,
                () => new Set()
              );
              topic.add(conn);
              subscribedTopics.add(topicName);
              console.log(
                `[Subscribe] User ${
                  (conn as any).user.email
                } subscribed to ${topicName}`
              );
            }
          });
          break;
        case "unsubscribe":
          (messageData.topics || []).forEach((topicName: string) => {
            const subs = topics.get(topicName);
            if (subs) {
              subs.delete(conn);
            }
          });
          break;
        case "publish": // y-webrtc는 이 이벤트를 시그널링에 사용
          if (messageData.topic) {
            const receivers = topics.get(messageData.topic);
            if (receivers) {
              // 보낸 사람을 제외한 모든 사람에게 메시지 전송
              receivers.forEach((receiver) => {
                if (receiver !== conn) {
                  send(receiver, messageData);
                }
              });
            }
          }
          break;
        case "ping":
          send(conn, { type: "pong" });
      }
    }
  });
});

server.on("upgrade", (request, socket, head) => {
  // --- ▼▼▼ JWT 인증 로직 추가 ▼▼▼ ---
  try {
    const url = new URL(request.url!, `ws://${request.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      console.error("[Auth] Upgrade rejected: No token provided.");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
      email: string;
    };

    // 인증 성공 시, wss.handleUpgrade 호출
    wss.handleUpgrade(request, socket, head, (ws) => {
      // ws 객체에 사용자 정보 주입
      (ws as any).user = decoded;
      wss.emit("connection", ws, request);
    });
  } catch (err) {
    console.error("[Auth] Upgrade rejected: Invalid token.");
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  // --- ▲▲▲ JWT 인증 로직 끝 ▲▲▲ ---
});

server.listen(PORT, () => {
  console.log(
    `✅ Official y-webrtc Signaling Server listening on port ${PORT}`
  );
});
