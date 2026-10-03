export type CapabilityDestination = {
  label: string;
  route: string;
};

const DESTINATIONS: Record<string, CapabilityDestination> = {
  "builder.app.generate": { label: "Open AI Builder", route: "/workspace/ai-builder" },
  "builder.website.generate": { label: "Open AI Builder", route: "/workspace/ai-builder" },
  "builder.workflow.generate": { label: "Open AI Builder", route: "/workspace/ai-builder/Workflows" },
  "builder.database.generate": { label: "Open AI Builder", route: "/workspace/ai-builder/Projects" },
  "builder.live.edit": { label: "Open Live Builder", route: "/live-build-studio" },
  "builder.agent.test": { label: "Open AI Agents", route: "/workspace/ai-builder/AI%20Agents" },
  "media.video.create": { label: "Open Media Studio", route: "/workspace/media-studio/Videos" },
  "career.opportunity.search": { label: "Open Career Hub", route: "/workspace/career-hub/Jobs" },
  "learning.tutor.ask": { label: "Open Learning Hub", route: "/workspace/learning-hub/Tutor" },
  "wallet.overview": { label: "Open Wallet", route: "/workspace/wallet" },
  "assistant.tasks.organize": { label: "Open Personal Assistant", route: "/workspace/personal-assistant/Tasks" },
};

export function destinationForCapability(capability: string | null | undefined): CapabilityDestination | null {
  if (!capability) return null;
  return DESTINATIONS[capability] ?? null;
}
