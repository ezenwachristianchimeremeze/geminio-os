import { describe, expect, it } from "vitest";
import { redactForClient } from "../server/ai-core/redact";

describe("redactForClient", () => {
  it("removes trusted-server parameters and signed URLs from plans", () => {
    const run = { id: "r1", plan: { steps: [{ input: { message: "hi", attachmentParts: [{ type: "image_url", image_url: { url: "https://s.test/a.png?X-Amz-Signature=abc123" } }], webContext: "UNTRUSTED...", personalization: "be formal", stepRole: "You are...", webSources: [{ url: "https://a.test/x" }] } }] }, result: { output: { text: "see https://s.test/f?Signature=zzz&x=1 ok" } } };
    const out = redactForClient(run) as any;
    const input = out.plan.steps[0].input;
    expect(input.attachmentParts).toBeUndefined(); expect(input.webContext).toBeUndefined(); expect(input.personalization).toBeUndefined(); expect(input.stepRole).toBeUndefined();
    expect(input.message).toBe("hi"); expect(input.webSources).toHaveLength(1);
    expect(out.result.output.text).toBe("see [signed-url-removed] ok");
    expect(JSON.stringify(out)).not.toContain("abc123");
  });
  it("masks secret-looking keys, preserves dates and does not mutate input", () => {
    const d = new Date(); const input = { apiKey: "k", nested: { Authorization: "Bearer x", when: d }, list: [{ password: "p" }] };
    const out = redactForClient(input) as any;
    expect(out.apiKey).toBe("[REDACTED]"); expect(out.nested.Authorization).toBe("[REDACTED]"); expect(out.nested.when).toBe(d); expect(out.list[0].password).toBe("[REDACTED]");
    expect(input.apiKey).toBe("k");
  });
  it("handles null, primitives and very deep structures", () => {
    expect(redactForClient(null)).toBeNull(); expect(redactForClient(5)).toBe(5);
    let deep: any = { v: 1 }; for (let i = 0; i < 30; i++) deep = { n: deep };
    expect(() => redactForClient(deep)).not.toThrow();
  });
});
