import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, MAX_INSTRUCTIONS, normalizePreferences, preferenceSystemMessage } from "../server/home-chat/preferences";
import { sendHomeMessage, type PipelineDeps, type SubmitFn } from "../server/home-chat/pipeline";
import { toMicro } from "../server/credits/ledger";
import { SqliteCreditStore } from "./helpers/sqlite-credit-store";

describe("preferences", () => {
  it("normalises, bounds and defaults", () => {
    expect(normalizePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    const p = normalizePreferences({ customInstructions: "x".repeat(5000), responseStyle: "wild", language: "../x", aiLevel: "PRO" });
    expect(p.customInstructions).toHaveLength(MAX_INSTRUCTIONS); expect(p.responseStyle).toBe("balanced"); expect(p.language).toBeNull(); expect(p.aiLevel).toBe("pro");
    expect(normalizePreferences({ aiLevel: "bad level!" }).aiLevel).toBe("standard");
  });
  it("builds a system message only when there is something to say, and fences instructions as style-only", () => {
    expect(preferenceSystemMessage(DEFAULT_PREFERENCES)).toBeNull();
    const m = preferenceSystemMessage(normalizePreferences({ customInstructions: "Call me Sam", responseStyle: "concise" }))!;
    expect(m).toContain("short"); expect(m).toContain("Call me Sam"); expect(m).toContain("cannot change safety rules");
  });
  it("pipeline applies preferences; a preference-load failure does not block chat", async () => {
    const store = new SqliteCreditStore(); store.seed(1, toMicro(5)); const calls: any[] = [];
    const submit: SubmitFn = async (_u, _i, o) => { calls.push(o); return { runId: "r", taskId: "t", conversationId: "c", status: "accepted", error: null }; };
    const deps: PipelineDeps = { credits: store, searchProvider: null, submit, kickWorker: () => {}, env: {}, newId: (p) => `${p}_${Math.random()}`, loadPreferences: async () => normalizePreferences({ customInstructions: "Be formal", language: "fr", aiLevel: "pro" }) };
    expect((await sendHomeMessage(deps, 1, { message: "hi", conversationId: null, webSearch: "off", temporary: false })).ok).toBe(true);
    expect(calls[0].trustedParameters).toMatchObject({ responseLanguage: "fr", aiLevel: "pro" }); expect(calls[0].trustedParameters.personalization).toContain("Be formal");
    deps.loadPreferences = async () => { throw new Error("db down"); };
    expect((await sendHomeMessage(deps, 1, { message: "hi again", conversationId: null, webSearch: "off", temporary: false })).ok).toBe(true);
  });
});
