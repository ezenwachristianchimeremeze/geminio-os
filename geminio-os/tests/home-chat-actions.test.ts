import { describe, expect, it } from "vitest";
import { ActionError, ACTION_TTL_MS, clientView, decideAction, MAX_PENDING, proposeAction, type ActionDefinition, type ActionDeps, type ActionRow, type ActionStore } from "../server/home-chat/actions";

class Mem implements ActionStore {
  rows = new Map<string, ActionRow>();
  async insert(r: ActionRow) { this.rows.set(r.id, structuredClone(r)); }
  async get(u: number, id: string) { const r = this.rows.get(id); return r && r.userId === u ? structuredClone(r) : null; }
  async list(u: number) { return [...this.rows.values()].filter((r) => r.userId === u); }
  async countPending(u: number) { return [...this.rows.values()].filter((r) => r.userId === u && r.status === "pending").length; }
  async transition(u: number, id: string, from: any, to: any, patch: any, now: Date) { const r = this.rows.get(id); if (!r || r.userId !== u || r.status !== from) return false; Object.assign(r, patch, { status: to, updatedAt: now }); return true; }
}
let n = 0; let clock = new Date("2026-10-07T12:00:00Z");
const world = (over: Partial<ActionDefinition> = {}) => {
  const executed: any[] = []; const audits: string[] = [];
  const def: ActionDefinition = { type: "deploy_request", label: "Request deployment", estimatedCredits: 0, reversible: false, reversalNote: "A deployment review can be withdrawn only by an administrator.",
    describe: async (u, p) => { if (p.workspaceId !== "w-mine" || u !== 1) throw new ActionError("NOT_FOUND", "Project not found."); return { resourceId: "w-mine", resourceLabel: "My Shop", summary: "Request a deployment review of the latest version.", consequences: ["A review is created and waits for approval.", "Nothing is published."], params: { workspaceId: "w-mine", versionId: "v1" } }; },
    execute: async (u, p) => { executed.push({ u, p }); return { summary: "Deployment review created." }; }, ...over };
  const store = new Mem();
  const deps: ActionDeps = { store, registry: { deploy_request: def, delete_project: { type: "delete_project", label: "Delete project", estimatedCredits: 0, reversible: false, reversalNote: "", describe: async () => { throw new Error("x"); }, unavailableReason: "Project deletion isn't implemented." } }, now: () => clock, newId: () => `act_${++n}`, audit: async (e) => { audits.push(e.action); } };
  return { store, deps, executed, audits };
};

describe("approval-gated actions", () => {
  it("proposing never executes; the card content comes from the server", async () => {
    const w = world(); const a = await proposeAction(w.deps, 1, { type: "deploy_request", params: { workspaceId: "w-mine", resourceLabel: "CLIENT LIES", summary: "CLIENT LIES" } });
    expect(a.status).toBe("pending"); expect(w.executed).toHaveLength(0);
    expect(clientView(a)).toMatchObject({ resourceLabel: "My Shop", reversible: false, estimatedCredits: 0 }); expect(JSON.stringify(clientView(a))).not.toContain("CLIENT LIES");
    expect(w.audits).toEqual(["home.action.proposed"]);
  });
  it("approve executes exactly once, even with concurrent/double approvals", async () => {
    const w = world(); const a = await proposeAction(w.deps, 1, { type: "deploy_request", params: { workspaceId: "w-mine" } });
    const r = await Promise.allSettled([decideAction(w.deps, 1, a.id, "approve"), decideAction(w.deps, 1, a.id, "approve"), decideAction(w.deps, 1, a.id, "approve")]);
    expect(w.executed).toHaveLength(1); expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((await w.store.get(1, a.id))).toMatchObject({ status: "executed", result: { summary: "Deployment review created." } });
    await expect(decideAction(w.deps, 1, a.id, "approve")).rejects.toMatchObject({ code: "CONFLICT" }); expect(w.executed).toHaveLength(1);
  });
  it("reject and cancel never execute and cannot be undone by a later approve", async () => {
    const w = world(); const a = await proposeAction(w.deps, 1, { type: "deploy_request", params: { workspaceId: "w-mine" } }); const b = await proposeAction(w.deps, 1, { type: "deploy_request", params: { workspaceId: "w-mine" } });
    expect((await decideAction(w.deps, 1, a.id, "reject")).status).toBe("rejected"); expect((await decideAction(w.deps, 1, b.id, "cancel")).status).toBe("cancelled");
    await expect(decideAction(w.deps, 1, a.id, "approve")).rejects.toMatchObject({ code: "CONFLICT" }); expect(w.executed).toHaveLength(0);
  });
  it("proposals expire server-side and an expired one cannot be approved", async () => {
    const w = world(); const a = await proposeAction(w.deps, 1, { type: "deploy_request", params: { workspaceId: "w-mine" } });
    clock = new Date(+clock + ACTION_TTL_MS + 1000);
    await expect(decideAction(w.deps, 1, a.id, "approve")).rejects.toMatchObject({ code: "EXPIRED" }); expect(w.executed).toHaveLength(0); expect((await w.store.get(1, a.id))?.status).toBe("expired");
    clock = new Date("2026-10-07T12:00:00Z");
  });
  it("foreign users cannot see, decide or propose against someone else's resource", async () => {
    const w = world(); const a = await proposeAction(w.deps, 1, { type: "deploy_request", params: { workspaceId: "w-mine" } });
    await expect(decideAction(w.deps, 2, a.id, "approve")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(proposeAction(w.deps, 2, { type: "deploy_request", params: { workspaceId: "w-mine" } })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(w.executed).toHaveLength(0);
  });
  it("unsupported or unknown actions cannot even be proposed (no fake destructive action)", async () => {
    const w = world();
    await expect(proposeAction(w.deps, 1, { type: "delete_project", params: {} })).rejects.toMatchObject({ code: "UNAVAILABLE", message: "Project deletion isn't implemented." });
    await expect(proposeAction(w.deps, 1, { type: "format_disk", params: {} })).rejects.toMatchObject({ code: "INVALID" });
  });
  it("execution failure is recorded truthfully and the action is not re-run", async () => {
    const w = world({ execute: async () => { throw new Error("deployment storage down"); } }); const a = await proposeAction(w.deps, 1, { type: "deploy_request", params: { workspaceId: "w-mine" } });
    expect(await decideAction(w.deps, 1, a.id, "approve")).toMatchObject({ status: "failed", error: "deployment storage down" });
    await expect(decideAction(w.deps, 1, a.id, "approve")).rejects.toMatchObject({ code: "CONFLICT" }); expect(w.audits).toContain("home.action.failed");
  });
  it("limits how many proposals can be waiting", async () => {
    const w = world(); for (let i = 0; i < MAX_PENDING; i++) await proposeAction(w.deps, 1, { type: "deploy_request", params: { workspaceId: "w-mine" } });
    await expect(proposeAction(w.deps, 1, { type: "deploy_request", params: { workspaceId: "w-mine" } })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("audits every transition", async () => {
    const w = world(); const a = await proposeAction(w.deps, 1, { type: "deploy_request", params: { workspaceId: "w-mine" } }); await decideAction(w.deps, 1, a.id, "approve");
    expect(w.audits).toEqual(["home.action.proposed", "home.action.approved", "home.action.executed"]);
  });
});
