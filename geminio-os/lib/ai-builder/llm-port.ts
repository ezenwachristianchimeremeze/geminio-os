/**
 * AI Builder LLM port.
 *
 * The AI Builder engines used to import `invokeLLM` from the server directly.
 * That (a) bypassed the AI Core provider layer (routing, usage metering, audit),
 * and (b) made a client-importable `lib/` module depend on server code.
 *
 * Engines now call `getAiBuilderLlm()`. The server registers the real
 * implementation (AI Core provider adapter) at startup via `setAiBuilderLlm`.
 * If nothing is registered the port throws a clear, non-retryable error rather
 * than returning fabricated output.
 */
export type AiBuilderLlmRequest = {
  system?: string;
  prompt: string;
  maxTokens?: number;
  /** Logical operation name used for metering/audit, e.g. "requirements.extract". */
  operation: string;
};

export type AiBuilderLlmResponse = { text: string; model?: string };

export type AiBuilderLlm = (request: AiBuilderLlmRequest) => Promise<AiBuilderLlmResponse>;

export class AiBuilderLlmUnavailableError extends Error {
  readonly retryable = false;
  constructor() {
    super("No AI provider is registered for the AI Builder. Configure the AI Core provider.");
    this.name = "AiBuilderLlmUnavailableError";
  }
}

let current: AiBuilderLlm | null = null;

export function setAiBuilderLlm(impl: AiBuilderLlm | null) {
  current = impl;
}

export function getAiBuilderLlm(): AiBuilderLlm {
  if (!current) {
    return async () => {
      throw new AiBuilderLlmUnavailableError();
    };
  }
  return current;
}

/**
 * Extract JSON from model output (tolerates ```json fences). Throws on invalid
 * JSON — callers must surface the failure instead of substituting empty data.
 */
export function parseModelJson<T = unknown>(text: string): T {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const body = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error("The AI provider returned output that is not valid JSON.");
  }
}

/**
 * Compatibility shim so existing engine call sites keep their shape while
 * routing through the registered AI Core implementation.
 */
export async function invokeViaPort(args: {
  operation: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  max_tokens?: number;
}): Promise<{ choices: { message: { content: string } }[] }> {
  const system = args.messages.find((m) => m.role === "system")?.content;
  const prompt = args.messages.filter((m) => m.role !== "system").map((m) => m.content).join("\n\n");
  const out = await getAiBuilderLlm()({ system, prompt, maxTokens: args.max_tokens, operation: args.operation });
  return { choices: [{ message: { content: out.text } }] };
}
