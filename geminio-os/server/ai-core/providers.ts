import { invokeLLM, invokeLLMStream, type InvokeResult, type Message, type Tool } from "../_core/llm";
import {
  aiProviderSchema,
  providerFailureSchema,
  type AiProvider,
  type ProviderFailure,
} from "../../shared/geminio-contracts";

export type ProviderRequest = {
  messages: Message[];
  model?: string;
  tools?: Tool[];
  outputSchema?: {
    name: string;
    schema: Record<string, unknown>;
    strict?: boolean;
  };
  maxTokens?: number;
  /** Optional: receive text deltas as they arrive (built-in endpoint only; other adapters ignore it and answer non-streaming). */
  onText?: (delta: string) => void;
  signal?: AbortSignal;
};

export type ProviderResponse = {
  provider: AiProvider;
  model: string;
  result: InvokeResult;
  latencyMs: number;
};

export type ProviderAdapter = {
  provider: AiProvider;
  isAvailable(): boolean;
  invoke(request: ProviderRequest): Promise<ProviderResponse>;
};

export class ProviderUnavailableError extends Error {
  readonly failure: ProviderFailure;

  constructor(provider: AiProvider, message: string, retryable = false) {
    super(message);
    this.name = "ProviderUnavailableError";
    this.failure = providerFailureSchema.parse({
      provider,
      code: "provider_unavailable",
      message,
      retryable,
      retryAfterMs: null,
    });
  }
}

class BuiltInLlmAdapter implements ProviderAdapter {
  readonly provider = aiProviderSchema.enum["builtin-llm"];

  isAvailable() {
    return true;
  }

  async invoke(request: ProviderRequest): Promise<ProviderResponse> {
    const startedAt = Date.now();
    const params = { messages: request.messages, model: request.model, tools: request.tools, outputSchema: request.outputSchema, maxTokens: request.maxTokens };
    const result = request.onText ? await invokeLLMStream(params, request.onText, request.signal) : await invokeLLM(params);
    return {
      provider: this.provider,
      model: result.model || request.model || "builtin-default",
      result,
      latencyMs: Date.now() - startedAt,
    };
  }
}

class UnavailableAdapter implements ProviderAdapter {
  constructor(readonly provider: AiProvider, private readonly reason: string) {}

  isAvailable() {
    return false;
  }

  async invoke(_request: ProviderRequest): Promise<ProviderResponse> {
    throw new ProviderUnavailableError(this.provider, this.reason, false);
  }
}

const adapters: ProviderAdapter[] = [
  new BuiltInLlmAdapter(),
  new UnavailableAdapter("anthropic", "Anthropic is not configured for this project."),
  new UnavailableAdapter("openrouter", "OpenRouter is not configured for this project."),
];

export function listProviderAdapters(): ProviderAdapter[] {
  return [...adapters];
}

export function getProviderAdapter(provider: AiProvider): ProviderAdapter {
  if (provider === "unavailable") {
    return new UnavailableAdapter("unavailable", "No AI provider is configured.");
  }
  return adapters.find((adapter) => adapter.provider === provider) ?? new UnavailableAdapter(provider, `${provider} is not registered.`);
}

export function resolveProvider(preferred?: AiProvider): ProviderAdapter {
  if (preferred) {
    const adapter = getProviderAdapter(preferred);
    if (adapter.isAvailable()) return adapter;
  }
  const available = adapters.find((adapter) => adapter.isAvailable());
  if (!available) throw new ProviderUnavailableError("unavailable", "No configured AI provider is available.");
  return available;
}

export function normalizeProviderError(error: unknown, provider: AiProvider): ProviderFailure {
  if (error instanceof ProviderUnavailableError) return error.failure;
  const message = error instanceof Error ? error.message : "Unknown provider failure";
  const retryable = /timeout|temporar|rate limit|429|5\d\d|network|fetch/i.test(message);
  return providerFailureSchema.parse({
    provider,
    code: retryable ? "provider_transient_failure" : "provider_request_failed",
    message: message.slice(0, 2000),
    retryable,
    retryAfterMs: null,
  });
}
