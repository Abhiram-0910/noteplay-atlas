import { io } from "socket.io-client";

export function createSocket(serverUrl) {
  return io(serverUrl, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    timeout: 10000
  });
}

