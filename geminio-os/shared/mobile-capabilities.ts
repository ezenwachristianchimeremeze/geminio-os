export type MobileCapabilityStatus = "implemented" | "boundary" | "unsupported-platform" | "planned";
export type MobileCapabilityGroup = "ui" | "state" | "native" | "backend" | "auth" | "ai" | "billing" | "integration" | "operations";

export interface MobileCapabilityDefinition {
  id: string;
  group: MobileCapabilityGroup;
  title: string;
  status: MobileCapabilityStatus;
  implementation: string;
  testId: string;
  providerRequired?: string;
  platforms: readonly ("ios" | "android" | "tablet" | "web" | "desktop")[];
}

export const MOBILE_CAPABILITIES = [
  { id: "ui.skeletons", group: "ui", title: "Skeleton loading surfaces", status: "implemented", implementation: "components/capability-foundations.tsx", testId: "capability-foundations" , platforms: ["ios", "android", "tablet", "web", "desktop"] },
  { id: "ui.bottom-sheet", group: "ui", title: "Accessible bottom sheets", status: "implemented", implementation: "components/capability-foundations.tsx", testId: "capability-foundations", platforms: ["ios", "android", "tablet", "web", "desktop"] },
  { id: "ui.virtualized-list", group: "ui", title: "Virtualized long lists", status: "implemented", implementation: "components/capability-foundations.tsx", testId: "capability-foundations", platforms: ["ios", "android", "tablet", "web", "desktop"] },
  { id: "ui.masonry", group: "ui", title: "Masonry content layouts", status: "implemented", implementation: "components/capability-foundations.tsx", testId: "capability-foundations", platforms: ["ios", "android", "tablet", "web", "desktop"] },
  { id: "ui.blur-gradient", group: "ui", title: "Blur and branded gradients", status: "implemented", implementation: "components/capability-foundations.tsx", testId: "capability-foundations", platforms: ["ios", "android", "tablet", "web", "desktop"] },
  { id: "state.offline-queue", group: "state", title: "Offline mutation queue", status: "implemented", implementation: "hooks/use-offline-mode.ts", testId: "offline-mode", platforms: ["ios", "android", "tablet", "web", "desktop"] },
  { id: "state.optimistic-updates", group: "state", title: "Optimistic updates with rollback", status: "implemented", implementation: "lib/advanced-state-manager.ts", testId: "advanced-state", platforms: ["ios", "android", "tablet", "web", "desktop"] },
  { id: "native.device-adapters", group: "native", title: "Battery, motion, brightness, clipboard, and sharing adapters", status: "implemented", implementation: "hooks/use-device-capabilities.ts", testId: "device-capabilities", platforms: ["ios", "android", "tablet", "web", "desktop"] },
  { id: "native.camera-location-media", group: "native", title: "Camera, location, and media adapters", status: "implemented", implementation: "lib/device-apis.ts", testId: "device-apis", platforms: ["ios", "android", "tablet", "web"] },
  { id: "backend.typed-contracts", group: "backend", title: "Typed task, approval, credit, entitlement, and usage contracts", status: "implemented", implementation: "shared/geminio-contracts.ts", testId: "geminio-contracts", platforms: ["ios", "android", "tablet", "web", "desktop"] },
  { id: "backend.external-providers", group: "backend", title: "External provider integration boundaries", status: "boundary", implementation: "lib/third-party-integrations.ts", testId: "integration-boundaries", providerRequired: "Provider credentials and OAuth consent", platforms: ["ios", "android", "tablet", "web", "desktop"] },
  { id: "ai.builtin-llm", group: "ai", title: "Built-in multimodal AI", status: "implemented", implementation: "server/_core/llm.ts", testId: "integration", platforms: ["ios", "android", "tablet", "web", "desktop"] },
  { id: "ai.external-models", group: "ai", title: "External model provider adapters", status: "boundary", implementation: "lib/ai-integrations.ts", testId: "integration-boundaries", providerRequired: "Provider API credentials", platforms: ["ios", "android", "tablet", "web", "desktop"] },
  { id: "billing.credits-entitlements", group: "billing", title: "Credits and entitlement ledger", status: "implemented", implementation: "server/routers.ts", testId: "geminio-contracts", platforms: ["ios", "android", "tablet", "web", "desktop"] },
  { id: "billing.purchase-providers", group: "billing", title: "RevenueCat and Stripe purchase boundary", status: "boundary", implementation: "lib/payment-integration.ts", testId: "integration-boundaries", providerRequired: "Store or payment-provider configuration", platforms: ["ios", "android", "tablet", "web", "desktop"] },
  { id: "operations.release", group: "operations", title: "EAS, OTA, store, and desktop release boundaries", status: "boundary", implementation: "lib/deployment-infrastructure.ts", testId: "comprehensive", providerRequired: "Developer accounts and signing credentials", platforms: ["ios", "android", "tablet", "web", "desktop"] },
] as const satisfies readonly MobileCapabilityDefinition[];

export function getCapabilitiesByGroup(group: MobileCapabilityGroup) {
  return MOBILE_CAPABILITIES.filter((capability) => capability.group === group);
}

export function getCapabilitySummary() {
  return MOBILE_CAPABILITIES.reduce<Record<MobileCapabilityStatus, number>>(
    (summary, capability) => {
      summary[capability.status] += 1;
      return summary;
    },
    { implemented: 0, boundary: 0, "unsupported-platform": 0, planned: 0 },
  );
}
