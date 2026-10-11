/**
 * Geminio OS - Real-Time WebSocket Server
 * 
 * Handles:
 * - Notification broadcasting
 * - Live chat updates
 * - Real-time alerts
 * - User presence
 */

import { Server as HTTPServer } from "http";
import { WebSocketServer, WebSocket, RawData } from "ws";
import { EventEmitter } from "events";
import type { IncomingMessage } from "http";

interface NotificationMessage {
  type: "notification" | "alert" | "reminder" | "opportunity" | "chat";
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  timestamp: Date;
  id: string;
}

interface UserConnection {
  userId: string;
  ws: WebSocket;
  connectedAt: Date;
}

class NotificationManager extends EventEmitter {
  private wss: WebSocketServer;
  private userConnections: Map<string, UserConnection[]> = new Map();
  private messageQueue: Map<string, NotificationMessage[]> = new Map();

  constructor(server: HTTPServer) {
    super();
    this.wss = new WebSocketServer({ server, path: "/ws/notifications" });
    this.setupWebSocketServer();
  }

  private setupWebSocketServer() {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const userId = url.searchParams.get("userId");

      if (!userId) {
        ws.close(1008, "Missing userId");
        return;
      }

      this.addUserConnection(userId, ws);

      ws.on("message", (data: RawData) => this.handleMessage(userId, data));
      ws.on("close", () => this.removeUserConnection(userId, ws));
      ws.on("error", (error: Error) => console.error("WebSocket error:", error));

      // Send queued messages
      this.sendQueuedMessages(userId);
    });
  }

  private addUserConnection(userId: string, ws: WebSocket) {
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, []);
    }
    this.userConnections.get(userId)!.push({
      userId,
      ws,
      connectedAt: new Date(),
    });
    console.log(`User ${userId} connected`);
  }

  private removeUserConnection(userId: string, ws: WebSocket) {
    const connections = this.userConnections.get(userId);
    if (connections) {
      const index = connections.findIndex((c) => c.ws === ws);
      if (index !== -1) {
        connections.splice(index, 1);
      }
      if (connections.length === 0) {
        this.userConnections.delete(userId);
      }
    }
    console.log(`User ${userId} disconnected`);
  }

  private handleMessage(userId: string, data: RawData) {
    try {
      const message = JSON.parse(data.toString());
      console.log(`Message from ${userId}:`, message);

      // Handle different message types
      if (message.type === "ping") {
        this.sendToUser(userId, { type: "pong", timestamp: new Date() });
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Error handling message:", err);
    }
  }

  private sendQueuedMessages(userId: string) {
    const queue = this.messageQueue.get(userId);
    if (queue && queue.length > 0) {
      queue.forEach((msg) => this.sendToUser(userId, msg));
      this.messageQueue.delete(userId);
    }
  }

  public sendToUser(userId: string, message: unknown) {
    const connections = this.userConnections.get(userId);

    if (!connections || connections.length === 0) {
      // Queue message for later delivery
      if (!this.messageQueue.has(userId)) {
        this.messageQueue.set(userId, []);
      }
      this.messageQueue.get(userId)!.push(message as NotificationMessage);
      return;
    }

    const payload = JSON.stringify(message);
    connections.forEach((conn) => {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(payload);
      }
    });
  }

  public broadcastToUsers(userIds: string[], message: unknown) {
    userIds.forEach((userId) => this.sendToUser(userId, message));
  }

  public sendNotification(notification: NotificationMessage) {
    this.sendToUser(notification.userId, {
      ...notification,
      timestamp: new Date(),
    });
    this.emit("notification", notification);
  }

  public getConnectedUsers(): string[] {
    return Array.from(this.userConnections.keys());
  }

  public getUserConnectionCount(userId: string): number {
    return this.userConnections.get(userId)?.length || 0;
  }
}

export { NotificationManager, NotificationMessage };
