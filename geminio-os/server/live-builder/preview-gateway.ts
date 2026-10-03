import { randomUUID } from "node:crypto";

export type PreviewGatewaySession = {
  id: string;
  userId: number;
  workspaceId: string;
  versionId: string | null;
  runtimeSessionId: string | null;
  authState: "authenticated" | "expired" | "revoked";
  expiresAt: string;
  createdAt: string;
};

export class PreviewGateway {
  private readonly sessions = new Map<string, PreviewGatewaySession>();

  create(input: { userId: number; workspaceId: string; versionId?: string | null; runtimeSessionId?: string | null; ttlMs?: number }): PreviewGatewaySession {
    const now = new Date();
    const session: PreviewGatewaySession = {
      id: `preview_${randomUUID()}`,
      userId: input.userId,
      workspaceId: input.workspaceId,
      versionId: input.versionId ?? null,
      runtimeSessionId: input.runtimeSessionId ?? null,
      authState: "authenticated",
      expiresAt: new Date(now.getTime() + (input.ttlMs ?? 15 * 60_000)).toISOString(),
      createdAt: now.toISOString(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  authorize(userId: number, sessionId: string, now = Date.now()): PreviewGatewaySession {
    const session = this.getOwned(userId, sessionId);
    if (session.authState === "revoked") throw new Error("Preview session has been revoked");
    if (Date.parse(session.expiresAt) <= now) {
      const expired = { ...session, authState: "expired" as const };
      this.sessions.set(session.id, expired);
      throw new Error("Preview session has expired");
    }
    return session;
  }

  revoke(userId: number, sessionId: string): PreviewGatewaySession {
    const session = this.getOwned(userId, sessionId);
    const revoked = { ...session, authState: "revoked" as const };
    this.sessions.set(session.id, revoked);
    return revoked;
  }

  cleanup(now = Date.now()): number {
    let count = 0;
    for (const [id, session] of this.sessions) {
      if (session.authState === "revoked" || Date.parse(session.expiresAt) <= now) {
        this.sessions.delete(id);
        count += 1;
      }
    }
    return count;
  }

  listOwned(userId: number): PreviewGatewaySession[] {
    return [...this.sessions.values()].filter((session) => session.userId === userId);
  }

  private getOwned(userId: number, sessionId: string): PreviewGatewaySession {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) throw new Error("Preview session not found");
    return session;
  }
}

export const defaultPreviewGateway = new PreviewGateway();
