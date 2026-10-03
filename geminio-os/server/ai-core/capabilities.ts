import {
  capabilityDescriptorSchema,
  capabilityIdSchema,
  type CapabilityDescriptor,
  type CapabilityId,
} from "../../shared/geminio-contracts";
import type { Message } from "../_core/llm";

export type CapabilityHandlerContext = {
  userId: number;
  runId: string;
  taskId: string | null;
  projectId: string | null;
  requestMessage: string;
  parameters: Record<string, unknown>;
  conversationMessages: Message[];
};

export type CapabilityExecutionInstruction = {
  messages: Message[];
  maxTokens: number;
  outputKind: "conversation" | "implementation" | "plan" | "test";
  verificationCheck: string;
};

export type CapabilityHandler = (context: CapabilityHandlerContext) => CapabilityExecutionInstruction;

export type RegisteredCapability = {
  descriptor: CapabilityDescriptor;
  handler?: CapabilityHandler;
};

const builderInstruction = (title: string, outputKind: CapabilityExecutionInstruction["outputKind"]): CapabilityHandler => (context) => ({
  messages: [
    {
      role: "system",
      content: `You are the Geminio OS ${title} execution worker. Return a reviewable, implementation-focused response. Do not claim that files were exported, deployed, purchased, deleted, or connected unless a dedicated external execution provider reports success. State assumptions and verification steps clearly.`,
    },
    {
      role: "user",
      content: `Request: ${context.requestMessage}\nParameters: ${JSON.stringify(context.parameters)}\nProject reference: ${context.projectId ?? "not supplied"}`,
    },
  ],
  maxTokens: 4000,
  outputKind,
  verificationCheck: "The configured AI provider returned a reviewable capability-specific response.",
});

const definitions: RegisteredCapability[] = [
  {
    descriptor: {
      id: "conversation.reply",
      displayName: "Conversation reply",
      description: "Answer a user message using the current conversation context.",
      inputSchema: { message: { type: "string" } },
      risk: "read",
      supportedProviders: ["builtin-llm", "anthropic", "openrouter"],
      requiresApproval: false,
      enabled: true,
    },
    handler: (context) => ({
      messages: context.conversationMessages.length > 0
        ? context.conversationMessages
        : [{ role: "user", content: context.requestMessage }],
      maxTokens: 2000,
      outputKind: "conversation",
      verificationCheck: "The configured AI provider returned a response using the durable conversation context.",
    }),
  },
  {
    descriptor: {
      id: "builder.app.generate",
      displayName: "Generate a mobile app",
      description: "Generate or revise a React Native application project from a natural-language brief.",
      inputSchema: { brief: { type: "string" }, projectId: { type: "string", nullable: true } },
      risk: "write",
      supportedProviders: ["builtin-llm", "anthropic", "openrouter"],
      requiresApproval: false,
      enabled: true,
    },
    handler: builderInstruction("React Native application builder", "implementation"),
  },
  {
    descriptor: {
      id: "builder.live.edit",
      displayName: "Plan a scoped Live Builder edit",
      description: "Inspect a persisted Live Builder workspace and propose a reviewable, scoped change for the selected file or preview element.",
      inputSchema: { brief: { type: "string" }, workspaceId: { type: "string" }, selectedElement: { type: "object", nullable: true } },
      risk: "write",
      supportedProviders: ["builtin-llm", "anthropic", "openrouter"],
      requiresApproval: false,
      enabled: true,
    },
    handler: (context) => ({
      messages: [
        {
          role: "system",
          content: "You are the Geminio OS Live Builder coding agent. Inspect the supplied workspace context before proposing a minimal, reviewable change. Preserve unrelated files and behavior. Return an implementation plan, impacted file paths, dependency considerations, verification steps, and risks. Do not claim that source files, previews, tests, or deployments changed unless a dedicated execution provider reports that result.",
        },
        {
          role: "user",
          content: `Request: ${context.requestMessage}\nWorkspace context: ${JSON.stringify(context.parameters)}\nProject reference: ${context.projectId ?? "not supplied"}`,
        },
      ],
      maxTokens: 4_000,
      outputKind: "plan",
      verificationCheck: "The configured AI provider returned a scoped, reviewable Live Builder edit plan.",
    }),
  },
  {
    descriptor: {
      id: "builder.website.generate",
      displayName: "Generate a website",
      description: "Generate or revise a website project from a natural-language brief.",
      inputSchema: { brief: { type: "string" }, projectId: { type: "string", nullable: true } },
      risk: "write",
      supportedProviders: ["builtin-llm", "anthropic", "openrouter"],
      requiresApproval: false,
      enabled: true,
    },
    handler: builderInstruction("website builder", "implementation"),
  },
  {
    descriptor: {
      id: "builder.workflow.generate",
      displayName: "Generate a workflow",
      description: "Design an automation workflow with typed nodes and conditions.",
      inputSchema: { brief: { type: "string" }, projectId: { type: "string", nullable: true } },
      risk: "write",
      supportedProviders: ["builtin-llm", "anthropic", "openrouter"],
      requiresApproval: false,
      enabled: true,
    },
    handler: builderInstruction("workflow builder", "plan"),
  },
  {
    descriptor: {
      id: "builder.database.generate",
      displayName: "Generate a database schema",
      description: "Generate a database schema and migration plan from a data-model brief.",
      inputSchema: { brief: { type: "string" }, projectId: { type: "string", nullable: true } },
      risk: "write",
      supportedProviders: ["builtin-llm", "anthropic", "openrouter"],
      requiresApproval: false,
      enabled: true,
    },
    handler: builderInstruction("database designer", "plan"),
  },
  {
    descriptor: {
      id: "builder.agent.test",
      displayName: "Test an AI agent",
      description: "Run a controlled test of an AI agent configuration and return verification results.",
      inputSchema: { prompt: { type: "string" }, agentId: { type: "string", nullable: true } },
      risk: "read",
      supportedProviders: ["builtin-llm", "anthropic", "openrouter"],
      requiresApproval: false,
      enabled: true,
    },
    handler: builderInstruction("AI agent test runner", "test"),
  },
  {
    descriptor: {
      id: "media.video.create",
      displayName: "Create a video",
      description: "Plan a video project and prepare a reviewable Media Studio workflow.",
      inputSchema: { brief: { type: "string" } },
      risk: "write",
      supportedProviders: ["builtin-llm", "anthropic", "openrouter"],
      requiresApproval: false,
      enabled: true,
    },
    handler: builderInstruction("Media Studio video planner", "implementation"),
  },
  {
    descriptor: {
      id: "career.opportunity.search",
      displayName: "Search career opportunities",
      description: "Prepare a reviewable search brief for jobs, scholarships, or internships.",
      inputSchema: { brief: { type: "string" } },
      risk: "read",
      supportedProviders: ["builtin-llm", "anthropic", "openrouter"],
      requiresApproval: false,
      enabled: true,
    },
    handler: builderInstruction("Career Hub opportunity assistant", "plan"),
  },
  {
    descriptor: {
      id: "learning.tutor.ask",
      displayName: "Ask the Learning Hub tutor",
      description: "Answer a learning question with a structured explanation and practice path.",
      inputSchema: { question: { type: "string" } },
      risk: "read",
      supportedProviders: ["builtin-llm", "anthropic", "openrouter"],
      requiresApproval: false,
      enabled: true,
    },
    handler: builderInstruction("Learning Hub tutor", "conversation"),
  },
  {
    descriptor: {
      id: "wallet.overview",
      displayName: "Review Wallet",
      description: "Explain the user's wallet connection state without fabricating balances or transactions.",
      inputSchema: { request: { type: "string" } },
      risk: "read",
      supportedProviders: ["builtin-llm", "anthropic", "openrouter"],
      requiresApproval: false,
      enabled: true,
    },
    handler: builderInstruction("Wallet status assistant", "plan"),
  },
  {
    descriptor: {
      id: "assistant.tasks.organize",
      displayName: "Organize tasks",
      description: "Turn a natural-language request into a reviewable personal task plan.",
      inputSchema: { request: { type: "string" } },
      risk: "write",
      supportedProviders: ["builtin-llm", "anthropic", "openrouter"],
      requiresApproval: false,
      enabled: true,
    },
    handler: builderInstruction("Personal Assistant task planner", "plan"),
  },
  {
    descriptor: {
      id: "project.deploy",
      displayName: "Deploy a project",
      description: "Deploy a project to an external environment after explicit user approval.",
      inputSchema: { projectId: { type: "string" }, target: { type: "string" } },
      risk: "external_side_effect",
      supportedProviders: ["builtin-llm"],
      requiresApproval: true,
      enabled: true,
    },
  },
  {
    descriptor: {
      id: "project.delete",
      displayName: "Delete a project",
      description: "Delete a project after explicit user approval.",
      inputSchema: { projectId: { type: "string" } },
      risk: "external_side_effect",
      supportedProviders: ["builtin-llm"],
      requiresApproval: true,
      enabled: true,
    },
  },
];

const registry = new Map<CapabilityId, RegisteredCapability>(
  definitions.map((definition) => [definition.descriptor.id, definition]),
);

export function listCapabilities(): CapabilityDescriptor[] {
  return [...registry.values()].filter((item) => item.descriptor.enabled).map((item) => capabilityDescriptorSchema.parse(item.descriptor));
}

export function getCapability(id: string): RegisteredCapability | undefined {
  const parsed = capabilityIdSchema.safeParse(id);
  return parsed.success ? registry.get(parsed.data) : undefined;
}

export function registerCapability(capability: RegisteredCapability): void {
  const descriptor = capabilityDescriptorSchema.parse(capability.descriptor);
  registry.set(descriptor.id, { ...capability, descriptor });
}

export function capabilityPromptCatalog(): string {
  return listCapabilities()
    .map((capability) => `${capability.id}: ${capability.description} | risk=${capability.risk} | approval=${capability.requiresApproval}`)
    .join("\n");
}
