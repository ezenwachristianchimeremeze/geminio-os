import {
  aiIntentSchema,
  type AiIntent,
  type AiProvider,
  type CapabilityRisk,
} from "../../shared/geminio-contracts";
import { capabilityPromptCatalog, getCapability } from "./capabilities";
import { normalizeProviderError, resolveProvider } from "./providers";
import { resolveModel } from "./models";

const intentOutputSchema = {
  name: "geminio_ai_intent",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      capability: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      rationale: { type: "string" },
      requiresApproval: { type: "boolean" },
      risk: { type: "string", enum: ["read", "write", "external_side_effect"] },
      parameters: { type: "object", additionalProperties: true },
    },
    required: ["name", "capability", "confidence", "rationale", "requiresApproval", "risk", "parameters"],
  },
} as const;

export type RouteDecision = {
  intent: AiIntent;
  provider: AiProvider;
  fallbackUsed: boolean;
};

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === "object" && part && "text" in part ? String((part as { text: unknown }).text) : "")).join("\n");
  }
  return "";
}

export function deterministicRoute(message: string): AiIntent {
  const normalized = message.toLowerCase();
  let capability = "conversation.reply";
  let name = "Conversation reply";
  let risk: CapabilityRisk = "read";
  let requiresApproval = false;

  if (/deploy|publish|release|ship to production/.test(normalized)) {
    capability = "project.deploy";
    name = "Deploy a project";
    risk = "external_side_effect";
    requiresApproval = true;
  } else if (/delete project|remove project|destroy project/.test(normalized)) {
    capability = "project.delete";
    name = "Delete a project";
    risk = "external_side_effect";
    requiresApproval = true;
  } else if (/database|schema|sql|migration/.test(normalized)) {
    capability = "builder.database.generate";
    name = "Generate a database schema";
    risk = "write";
  } else if (/workflow|automation|trigger|webhook/.test(normalized)) {
    capability = "builder.workflow.generate";
    name = "Generate a workflow";
    risk = "write";
  } else if (/website|landing page|web page|html|css/.test(normalized)) {
    capability = "builder.website.generate";
    name = "Generate a website";
    risk = "write";
  } else if (/review (my )?project|project review|inspect (my )?project/.test(normalized)) {
    capability = "builder.live.edit";
    name = "Review a Live Builder project";
    risk = "write";
  } else if (/edit|change|modify|update|remove|add|move|fix|responsive/.test(normalized) && /selected|component|element|file|preview|workspace|builder/.test(normalized)) {
    capability = "builder.live.edit";
    name = "Plan a Live Builder edit";
    risk = "write";
  } else if (/mobile app|react native|expo app|android app|ios app/.test(normalized)) {
    capability = "builder.app.generate";
    name = "Generate a mobile app";
    risk = "write";
  } else if (/video|film|reel|clip/.test(normalized)) {
    capability = "media.video.create";
    name = "Create a video";
    risk = "write";
  } else if (/job|career|scholarship|internship|role/.test(normalized)) {
    capability = "career.opportunity.search";
    name = "Search career opportunities";
  } else if (/learn|study|python|course|tutor|explain/.test(normalized)) {
    capability = "learning.tutor.ask";
    name = "Ask the Learning Hub tutor";
  } else if (/wallet|balance|transaction|money/.test(normalized)) {
    capability = "wallet.overview";
    name = "Review Wallet";
  } else if (/plan my day|organize (my )?tasks|to-do|todo|task list/.test(normalized)) {
    capability = "assistant.tasks.organize";
    name = "Organize tasks";
    risk = "write";
  } else if (/test agent|evaluate agent|agent test/.test(normalized)) {
    capability = "builder.agent.test";
    name = "Test an AI agent";
  }

  const descriptor = getCapability(capability);
  return aiIntentSchema.parse({
    name,
    capability,
    confidence: descriptor ? 0.62 : 0.35,
    rationale: "Deterministic safety fallback used because structured provider routing was unavailable or invalid.",
    requiresApproval: descriptor?.descriptor.requiresApproval ?? requiresApproval,
    risk: descriptor?.descriptor.risk ?? risk,
    parameters: { message },
  });
}

export async function routeIntent(message: string, preferredProvider?: AiProvider): Promise<RouteDecision> {
  const provider = resolveProvider(preferredProvider);
  try {
    const response = await provider.invoke({
      model: resolveModel(process.env, { capability: "router" }),
      maxTokens: 1200,
      messages: [
        {
          role: "system",
          content: `You are Geminio OS's capability router. Select exactly one capability from this catalog. Do not claim an external operation succeeded. Preserve the user's requested parameters in the parameters object.\n\n${capabilityPromptCatalog()}`,
        },
        { role: "user", content: message },
      ],
      outputSchema: intentOutputSchema,
    });
    const raw = contentToText(response.result.choices[0]?.message?.content);
    const parsed = aiIntentSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || !getCapability(parsed.data.capability)) {
      return { intent: deterministicRoute(message), provider: provider.provider, fallbackUsed: true };
    }
    const descriptor = getCapability(parsed.data.capability)?.descriptor;
    const intent = aiIntentSchema.parse({
      ...parsed.data,
      requiresApproval: Boolean(descriptor?.requiresApproval || parsed.data.requiresApproval),
      risk: descriptor?.risk ?? parsed.data.risk,
    });
    return { intent, provider: provider.provider, fallbackUsed: false };
  } catch (error) {
    const failure = normalizeProviderError(error, provider.provider);
    console.warn("AI router fallback", failure);
    return { intent: deterministicRoute(message), provider: provider.provider, fallbackUsed: true };
  }
}


/**
 * Server-selected routing: the calling server code (never a client) names the capability, so
 * no provider call is spent classifying and the decision is deterministic and auditable.
 * `parameters` are persisted in the run plan, so queue retries keep their context.
 */
export function forcedRoute(capability: string, parameters: Record<string, unknown>, preferredProvider?: AiProvider): RouteDecision {
  const registered = getCapability(capability);
  if (!registered || !registered.descriptor.enabled) throw new Error(`Capability "${capability}" is not available.`);
  const provider = resolveProvider(preferredProvider);
  const intent = aiIntentSchema.parse({
    name: registered.descriptor.displayName,
    capability,
    confidence: 1,
    rationale: "Capability selected by trusted server code.",
    requiresApproval: registered.descriptor.requiresApproval,
    risk: registered.descriptor.risk,
    parameters,
  });
  return { intent, provider: provider.provider, fallbackUsed: false };
}

/** No provider call: the deterministic fallback as a RouteDecision (used when the classification call cannot be paid for). */
export function deterministicDecision(message: string, preferredProvider?: AiProvider): RouteDecision {
  return { intent: deterministicRoute(message), provider: resolveProvider(preferredProvider).provider, fallbackUsed: true };
}
