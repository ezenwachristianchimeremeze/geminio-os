/** Server-sent-events parsing and OpenAI-compatible chat-completion streaming (pure; fetch is injectable). */
export async function* iterateSse(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader(); const decoder = new TextDecoder("utf-8"); let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done }).replace(/\r\n?/g, "\n");
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const event = buffer.slice(0, idx); buffer = buffer.slice(idx + 2);
        const data = event.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).replace(/^ /, "")).join("\n");
        if (data) yield data;
      }
      if (done) break;
    }
    const tail = buffer.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).replace(/^ /, "")).join("\n");
    if (tail) yield tail;
  } finally { reader.releaseLock?.(); }
}

export type StreamResult = { content: string; model: string | null; finishReason: string | null; usage: unknown | null; chunks: number };
export class StreamError extends Error { constructor(message: string, readonly retryable: boolean, readonly status?: number) { super(message); this.name = "StreamError"; } }

export async function streamChatCompletion(opts: { url: string; headers: Record<string, string>; payload: Record<string, unknown>; onText: (delta: string) => void; signal?: AbortSignal; fetchImpl?: typeof fetch }): Promise<StreamResult> {
  const f = opts.fetchImpl ?? fetch;
  const res = await f(opts.url, { method: "POST", headers: { ...opts.headers, accept: "text/event-stream" }, body: JSON.stringify({ ...opts.payload, stream: true }), signal: opts.signal });
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new StreamError(`LLM stream failed: ${res.status} ${res.statusText} – ${t.slice(0, 300)}`, res.status === 429 || res.status >= 500, res.status); }
  if (!res.body) throw new StreamError("LLM stream returned no body.", true);
  const out: StreamResult = { content: "", model: null, finishReason: null, usage: null, chunks: 0 };
  for await (const data of iterateSse(res.body)) {
    if (data.trim() === "[DONE]") break;
    let json: any;
    try { json = JSON.parse(data); } catch { continue; } // tolerate keep-alives / partial garbage
    if (json?.error) throw new StreamError(String(json.error?.message ?? "LLM stream error"), false);
    out.chunks++;
    if (typeof json.model === "string") out.model = json.model;
    if (json.usage) out.usage = json.usage;
    const choice = json.choices?.[0];
    const delta = choice?.delta?.content;
    if (typeof delta === "string" && delta) { out.content += delta; opts.onText(delta); }
    if (choice?.finish_reason) out.finishReason = choice.finish_reason;
  }
  if (!out.content && out.chunks === 0) throw new StreamError("LLM stream ended without any content.", true);
  return out;
}

/** Throttled progress writer: calls flush at most every `intervalMs` and only when at least `minChars` new characters exist. */
export function makeThrottledProgress(flush: (text: string) => Promise<void> | void, opts: { intervalMs?: number; minChars?: number; now?: () => number } = {}) {
  const interval = opts.intervalMs ?? 800; const minChars = opts.minChars ?? 40; const now = opts.now ?? Date.now;
  let text = ""; let lastAt = 0; let lastLen = 0; let pending: Promise<void> = Promise.resolve();
  return {
    push(delta: string) {
      text += delta;
      if (now() - lastAt >= interval && text.length - lastLen >= minChars) { lastAt = now(); lastLen = text.length; const snap = text; pending = pending.then(() => flush(snap)); }
    },
    async done() { await pending; return text; },
    get text() { return text; },
  };
}
