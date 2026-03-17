import { io } from "socket.io-client";
import { SOCKET_URL } from "../lib/api";
import { getAccessToken } from "./authService";
import { apiRequest } from "./apiClient";

export function connectChatSocket() {
  const accessToken = getAccessToken();

  return io(SOCKET_URL, {
    autoConnect: false,
    transports: ["websocket", "polling"],
    auth: {
      accessToken,
    },
  });
}

export function fetchChatBootstrap() {
  return apiRequest("/api/chat/bootstrap");
}

export function createChatThread(payload) {
  return apiRequest("/api/chat/threads", {
    method: "POST",
    body: payload,
  });
}

export function updateChatThread(threadId, payload) {
  return apiRequest(`/api/chat/threads/${threadId}`, {
    method: "PATCH",
    body: payload,
  });
}
