import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { validateSupabaseToken, type SupabaseUser } from "./supabase-admin";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

interface ClientMessage {
  type: "auth" | "ping";
  token?: string;
}

interface ServerMessage {
  type: "auth_ok" | "auth_error" | "new_message" | "message_delivered" | "unread_update" | "nutrition_targets_update" | "pong" | "error";
  payload?: Record<string, unknown>;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

const connectionRegistry = new Map<string, Set<AuthenticatedWebSocket>>();

let wss: WebSocketServer | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

export function initWebSocket(httpServer: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: AuthenticatedWebSocket) => {
    ws.isAlive = true;

    const authTimeout = setTimeout(() => {
      if (!ws.userId) {
        sendMessage(ws, { type: "auth_error", payload: { error: "Authentication timeout" } });
        ws.close(4001, "Authentication timeout");
      }
    }, 10000);

    ws.on("message", async (data) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());

        switch (message.type) {
          case "auth":
            if (ws.userId) {
              sendMessage(ws, { type: "error", payload: { error: "Already authenticated" } });
              return;
            }

            if (!message.token) {
              sendMessage(ws, { type: "auth_error", payload: { error: "Token required" } });
              ws.close(4002, "Token required");
              return;
            }

            const user = await validateSupabaseToken(message.token);
            if (!user) {
              sendMessage(ws, { type: "auth_error", payload: { error: "Invalid token" } });
              ws.close(4003, "Invalid token");
              return;
            }

            clearTimeout(authTimeout);
            ws.userId = user.id;
            addConnection(user.id, ws);
            sendMessage(ws, { type: "auth_ok", payload: { userId: user.id } });
            console.log(`[ws] User ${user.id} connected`);
            break;

          case "ping":
            ws.isAlive = true;
            sendMessage(ws, { type: "pong" });
            break;

          default:
            sendMessage(ws, { type: "error", payload: { error: "Unknown message type" } });
        }
      } catch (error) {
        console.error("[ws] Message parse error:", error);
        sendMessage(ws, { type: "error", payload: { error: "Invalid message format" } });
      }
    });

    ws.on("close", () => {
      clearTimeout(authTimeout);
      if (ws.userId) {
        removeConnection(ws.userId, ws);
        console.log(`[ws] User ${ws.userId} disconnected`);
      }
    });

    ws.on("error", (error) => {
      console.error("[ws] Socket error:", error);
    });

    ws.on("pong", () => {
      ws.isAlive = true;
    });
  });

  heartbeatInterval = setInterval(() => {
    wss?.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (ws.isAlive === false) {
        if (ws.userId) {
          removeConnection(ws.userId, ws);
          console.log(`[ws] User ${ws.userId} terminated (no heartbeat)`);
        }
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  console.log("[ws] WebSocket server initialized on /ws");
  return wss;
}

export function shutdownWebSocket(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  if (wss) {
    wss.clients.forEach((ws) => {
      ws.close(1001, "Server shutting down");
    });
    wss.close();
    wss = null;
  }

  connectionRegistry.clear();
  console.log("[ws] WebSocket server shutdown");
}

function addConnection(userId: string, ws: AuthenticatedWebSocket): void {
  if (!connectionRegistry.has(userId)) {
    connectionRegistry.set(userId, new Set());
  }
  connectionRegistry.get(userId)!.add(ws);
}

function removeConnection(userId: string, ws: AuthenticatedWebSocket): void {
  const connections = connectionRegistry.get(userId);
  if (connections) {
    connections.delete(ws);
    if (connections.size === 0) {
      connectionRegistry.delete(userId);
    }
  }
}

function sendMessage(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function isUserConnected(userId: string): boolean {
  const connections = connectionRegistry.get(userId);
  return connections !== undefined && connections.size > 0;
}

export function broadcastToUser(userId: string, message: ServerMessage): boolean {
  const connections = connectionRegistry.get(userId);
  if (!connections || connections.size === 0) {
    return false;
  }

  connections.forEach((ws) => {
    sendMessage(ws, message);
  });

  return true;
}

export function notifyNewMessage(recipientId: string, message: Message): boolean {
  return broadcastToUser(recipientId, {
    type: "new_message",
    payload: { message },
  });
}

export function notifyMessageDelivered(senderId: string, messageId: string, conversationId: string, deliveredAt: string): boolean {
  return broadcastToUser(senderId, {
    type: "message_delivered",
    payload: { messageId, conversationId, deliveredAt },
  });
}

export function notifyUnreadUpdate(userId: string, conversationId: string, unreadCount: number): boolean {
  return broadcastToUser(userId, {
    type: "unread_update",
    payload: { conversationId, unreadCount },
  });
}

export function notifyNutritionTargetsUpdate(clientId: string, professionalName: string): boolean {
  return broadcastToUser(clientId, {
    type: "nutrition_targets_update",
    payload: { professionalName },
  });
}

export function getConnectedUserCount(): number {
  return connectionRegistry.size;
}

export function getConnectionCount(): number {
  let count = 0;
  connectionRegistry.forEach((connections) => {
    count += connections.size;
  });
  return count;
}
