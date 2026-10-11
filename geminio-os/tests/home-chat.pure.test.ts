import { describe, expect, it } from "vitest";
import { BraveSearchProvider, needsWebSearch, normalizeSources, resolveSearchProvider, searchWeb, webContextMessage, type SearchProvider } from "../server/home-chat/web-search";
import { describeAttachmentIntent, suggestModule } from "../server/home-chat/intents";

describe("needsWebSearch", () => {
  it("detects current-information requests and honours the user's mode", () => {
    expect(needsWebSearch("What happened in today's technology news?")).toBe(true);
    expect(needsWebSearch("search the web for expo router docs")).toBe(true);
    expect(needsWebSearch("Explain recursion")).toBe(false);
    expect(needsWebSearch("what is the latest news, but don't search")).toBe(false);
    expect(needsWebSearch("Explain recursion", "on")).toBe(true);
    expect(needsWebSearch("latest news", "off")).toBe(false);
  });
});

describe("normalizeSources", () => {
  it("keeps only http(s), dedupes, strips markup and control characters, numbers from 1", () => {
    const out = normalizeSources([
      { title: "<b>A</b>", url: "https://www.example.com/a", snippet: "x\u0000y <script>z</script>" },
      { title: "dup", url: "https://example.com/a" },
      { title: "bad", url: "javascript:alert(1)" },
      { title: "file", url: "file:///etc/passwd" },
      { title: "nourl" } as never,
      { title: "B", url: "http://b.org/p" },
    ]);
    expect(out.map((s) => s.index)).toEqual([1, 2]);
    expect(out[0].title).toBe("A");
    expect(out[0].snippet).not.toContain("<");
    expect(out[0].snippet).not.toContain("\u0000");
    expect(out[0].host).toBe("example.com");
    expect(out[1].url).toBe("http://b.org/p");
  });
});

describe("searchWeb truthfulness", () => {
  it("reports unavailable (no invented sources) when no provider is configured", async () => {
    const r = await searchWeb(null, "anything");
    expect(r.status).toBe("unavailable");
    expect(resolveSearchProvider({})).toBeNull();
    expect(resolveSearchProvider({ WEB_SEARCH_PROVIDER: "other", WEB_SEARCH_API_KEY: "k" })).toBeNull();
    expect(resolveSearchProvider({ WEB_SEARCH_API_KEY: "k" })?.name).toBe("brave");
  });
  it("returns normalised sources from the provider", async () => {
    const p: SearchProvider = { name: "fake", search: async () => [{ title: "T", url: "https://a.com/x", snippet: "S" }] };
    const r = await searchWeb(p, "q");
    expect(r.status === "ok" && r.sources[0].index).toBe(1);
  });
  it("reports provider failure, timeout and empty results distinctly", async () => {
    const boom: SearchProvider = { name: "fake", search: async () => { throw Object.assign(new Error("HTTP 429"), { retryable: true }); } };
    const f = await searchWeb(boom, "q");
    expect(f).toMatchObject({ status: "failed", retryable: true });
    const slow: SearchProvider = { name: "fake", search: (_q, o) => new Promise((_, rej) => o.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })))) };
    expect(await searchWeb(slow, "q", { timeoutMs: 20 })).toMatchObject({ status: "failed", reason: "The search timed out.", retryable: true });
    const none: SearchProvider = { name: "fake", search: async () => [] };
    expect(await searchWeb(none, "q")).toMatchObject({ status: "failed", retryable: false });
    expect(await searchWeb(none, "   ")).toMatchObject({ status: "failed" });
  });
  it("Brave adapter builds the request and maps the response (fake fetch; live API NOT exercised)", async () => {
    let seen: { url: string; headers: Record<string, string> } | null = null;
    const fakeFetch = (async (url: string, init: { headers: Record<string, string> }) => { seen = { url, headers: init.headers }; return { ok: true, status: 200, json: async () => ({ web: { results: [{ title: "T", url: "https://a.com", description: "D" }] } }) }; }) as unknown as typeof fetch;
    const out = await new BraveSearchProvider("secret", fakeFetch).search("hello world", { limit: 3 });
    expect(out).toEqual([{ title: "T", url: "https://a.com", snippet: "D" }]);
    expect(seen!.url).toContain("q=hello%20world");
    expect(seen!.headers["X-Subscription-Token"]).toBe("secret");
    const failing = (async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(new BraveSearchProvider("k", failing).search("q", { limit: 1 })).rejects.toThrow("HTTP 503");
  });
  it("the model context labels results as untrusted data and asks for citations", () => {
    const msg = webContextMessage([{ index: 1, title: "T", url: "https://a.com", snippet: "S", host: "a.com" }], new Date("2026-10-04T00:00:00Z"));
    expect(msg).toContain("UNTRUSTED DATA");
    expect(msg).toContain("[1]");
    expect(msg).toContain("2026-10-04T00:00:00.000Z");
  });
});

describe("module suggestions (navigation only)", () => {
  const cases: [string, string][] = [
    ["Build me a React application.", "ai-builder"],
    ["Help me improve my CV.", "career-hub"],
    ["Teach me Python.", "learning-hub"],
    ["Create a business plan.", "business-hub"],
    ["Remind me tomorrow.", "personal-assistant"],
    ["What are today's major technology stories?", "news-hub"],
    ["Analyze this market data.", "markets"],
    ["Create an image for this article.", "media-studio"],
    ["Call this contact.", "phone-assistant"],
    ["Show my wallet balance", "wallet"],
  ];
  for (const [message, module] of cases) {
    it(`"${message}" -> ${module}`, () => { expect(suggestModule(message)?.module).toBe(module); });
  }
  it("returns null for ordinary conversation and flags modules whose backend is not connected", () => {
    expect(suggestModule("What is the capital of France?")).toBeNull();
    expect(suggestModule("Call this contact.")?.executable).toBe(false);
    expect(suggestModule("Call this contact.")?.note).toContain("not connected");
    expect(suggestModule("Create a business plan.")?.executable).toBe(false);
    expect(suggestModule("Help me improve my CV.")?.executable).toBe(true);
  });
  it("only suggests routes that exist in the product catalog ids", () => {
    const valid = new Set(["ai-builder", "media-studio", "career-hub", "business-hub", "learning-hub", "wallet", "marketplace", "phone-assistant", "security-guardian", "news-hub", "personal-assistant", "markets"]);
    for (const [m] of cases) { const h = suggestModule(m)!; expect(valid.has(h.module)).toBe(true); expect(h.route.startsWith(`/workspace/${h.module}`)).toBe(true); }
  });
  it("attachments route to analysis and code is never executed", () => {
    expect(describeAttachmentIntent("code")).toContain("Do not execute");
    expect(describeAttachmentIntent("other")).toContain("not supported");
  });
});
