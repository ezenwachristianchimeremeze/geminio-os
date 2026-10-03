import { z } from "zod";

export const analyticsConnectorSchema = z.enum(["snowflake", "bigquery", "databricks"]);
export type AnalyticsConnector = z.infer<typeof analyticsConnectorSchema>;

export const connectorConfigSchema = z.object({
  connector: analyticsConnectorSchema,
  accountLabel: z.string().min(1).max(120),
  credentialState: z.enum(["missing", "configured", "expired", "revoked"]),
  readOnly: z.boolean().default(true),
});
export type ConnectorConfig = z.infer<typeof connectorConfigSchema>;

export function canRunAnalyticsQuery(config: ConnectorConfig): boolean {
  return config.credentialState === "configured" && config.readOnly;
}

export function normalizeAnalyticsQuery(query: string): { sql: string; rejected: boolean; reason: string | null } {
  const sql = query.trim();
  const rejected = /\b(insert|update|delete|drop|alter|truncate|merge|create)\b/i.test(sql);
  return { sql, rejected, reason: rejected ? "Only read-only analytics queries are permitted." : null };
}
