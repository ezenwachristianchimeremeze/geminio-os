import { describe, expect, it } from "vitest";
import { canRunAnalyticsQuery, connectorConfigSchema, normalizeAnalyticsQuery } from "@/shared/data-connector-contracts";

describe("analytics connector contracts", () => {
  it("requires configured read-only connector access", () => {
    const config = connectorConfigSchema.parse({ connector: "bigquery", accountLabel: "warehouse", credentialState: "configured" });
    expect(canRunAnalyticsQuery(config)).toBe(true);
    expect(canRunAnalyticsQuery({ ...config, credentialState: "expired" })).toBe(false);
  });

  it("rejects mutating analytics queries", () => {
    expect(normalizeAnalyticsQuery("select count(*) from events").rejected).toBe(false);
    expect(normalizeAnalyticsQuery("DROP TABLE events").rejected).toBe(true);
  });
});
