export type ProviderKind = "oauth" | "api-key" | "service-account" | "native";
export type ProviderConnectionState = "not-configured" | "ready" | "reauth-required" | "syncing" | "error";

export interface ProviderDefinition {
  id: string;
  name: string;
  kind: ProviderKind;
  scopes: readonly string[];
  requiredSecrets: readonly string[];
  supportsWeb: boolean;
  supportsNative: boolean;
}

export interface ProviderConnection {
  providerId: string;
  state: ProviderConnectionState;
  connectedAt?: string;
  lastSyncedAt?: string;
  lastError?: string;
  retryAfterMs?: number;
}

export const PROVIDER_REGISTRY = [
  { id: "google-sheets", name: "Google Sheets", kind: "oauth", scopes: ["spreadsheets.read", "spreadsheets.write"], requiredSecrets: ["GOOGLE_CLIENT_ID"], supportsWeb: true, supportsNative: true },
  { id: "linear", name: "Linear", kind: "oauth", scopes: ["issues.read", "issues.write"], requiredSecrets: ["LINEAR_CLIENT_ID"], supportsWeb: true, supportsNative: true },
  { id: "github", name: "GitHub", kind: "oauth", scopes: ["repo.read", "issues.write"], requiredSecrets: ["GITHUB_CLIENT_ID"], supportsWeb: true, supportsNative: true },
  { id: "slack", name: "Slack", kind: "oauth", scopes: ["chat.write", "channels.read"], requiredSecrets: ["SLACK_CLIENT_ID"], supportsWeb: true, supportsNative: true },
  { id: "notion", name: "Notion", kind: "oauth", scopes: ["pages.read", "pages.write"], requiredSecrets: ["NOTION_CLIENT_ID"], supportsWeb: true, supportsNative: true },
  { id: "hubspot", name: "HubSpot", kind: "oauth", scopes: ["crm.read", "crm.write"], requiredSecrets: ["HUBSPOT_CLIENT_ID"], supportsWeb: true, supportsNative: true },
  { id: "jira", name: "Jira", kind: "oauth", scopes: ["issues.read", "issues.write"], requiredSecrets: ["JIRA_CLIENT_ID"], supportsWeb: true, supportsNative: true },
  { id: "data-warehouse", name: "Snowflake / BigQuery / Databricks", kind: "service-account", scopes: ["query.read"], requiredSecrets: ["DATA_WAREHOUSE_CONNECTION"], supportsWeb: true, supportsNative: false },
  { id: "maps", name: "Mapbox / Google Maps", kind: "api-key", scopes: ["maps.read"], requiredSecrets: ["MAPS_API_KEY"], supportsWeb: true, supportsNative: true },
  { id: "twilio", name: "Twilio", kind: "api-key", scopes: ["messages.send"], requiredSecrets: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"], supportsWeb: true, supportsNative: true },
  { id: "email", name: "SendGrid / Resend", kind: "api-key", scopes: ["email.send"], requiredSecrets: ["EMAIL_PROVIDER_API_KEY"], supportsWeb: true, supportsNative: true },
] as const satisfies readonly ProviderDefinition[];

export function getProviderDefinition(providerId: string) {
  return PROVIDER_REGISTRY.find((provider) => provider.id === providerId) ?? null;
}

export function canUseProvider(
  providerId: string,
  connection: ProviderConnection | null,
  platform: "web" | "native",
) {
  const definition = getProviderDefinition(providerId);
  if (!definition || !connection) return false;
  if (connection.state !== "ready") return false;
  return platform === "web" ? definition.supportsWeb : definition.supportsNative;
}

export function providerActionFailure(connection: ProviderConnection | null) {
  if (!connection || connection.state === "not-configured") return "Connect this provider before using the action.";
  if (connection.state === "reauth-required") return "Reconnect this provider to refresh its permissions.";
  if (connection.state === "syncing") return "This provider is syncing. Try again when synchronization completes.";
  if (connection.state === "error") return connection.lastError ?? "The provider is temporarily unavailable.";
  return null;
}
