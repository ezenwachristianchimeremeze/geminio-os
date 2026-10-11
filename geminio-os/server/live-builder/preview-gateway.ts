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

export type PreviewOwnershipCheck = {
  workspaceOwned(userId: number, workspaceId: string): Promise<boolean>;
  versionInWorkspace(userId: number, workspaceId: string, versionId: string): Promise<boolean>;
  runtimeInWorkspace(userId: number, workspaceId: string, sessionId: string): Promise<boolean>;
};

/** Mapped to NOT_FOUND by the router so a caller cannot probe whether another tenant's ids exist. */
export class PreviewOwnershipError extends Error { constructor(message: string) { super(message); this.name = "PreviewOwnershipError"; } }

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

  /**
   * Create a session only for resources the caller owns. `create` trusts its input; this is the entry point for client-supplied ids.
   * `verify` answers: does the user own the workspace, does the version belong to it, does the runtime session belong to it?
   */
  async createVerified(input: { userId: number; workspaceId: string; versionId?: string | null; runtimeSessionId?: string | null; ttlMs?: number }, verify: PreviewOwnershipCheck): Promise<PreviewGatewaySession> {
    if (!(await verify.workspaceOwned(input.userId, input.workspaceId))) throw new PreviewOwnershipError("Workspace not found.");
    if (input.versionId && !(await verify.versionInWorkspace(input.userId, input.workspaceId, input.versionId))) throw new PreviewOwnershipError("Version not found in this workspace.");
    if (input.runtimeSessionId && !(await verify.runtimeInWorkspace(input.userId, input.workspaceId, input.runtimeSessionId))) throw new PreviewOwnershipError("Runtime session not found in this workspace.");
    return this.create(input);
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
