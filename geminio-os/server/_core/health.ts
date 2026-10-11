/**
 * Dependency-aware readiness. Pure/injectable so it can be tested without a database.
 * The detail text is only returned outside production (the endpoint is unauthenticated).
 */
export type DatabaseHealth = { ok: boolean; reason?: string };

export async function evaluateDatabaseHealth(input: {
  databaseUrl: string | undefined;
  getClient: () => Promise<unknown | null>;
  ping: (client: unknown) => Promise<unknown>;
  nodeEnv?: string;
  timeoutMs?: number;
}): Promise<DatabaseHealth> {
  const expose = input.nodeEnv !== "production";
  const fail = (detail: string): DatabaseHealth => ({ ok: false, reason: expose ? detail : "Database check failed." });
  if (!input.databaseUrl) return fail("DATABASE_URL is not configured.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Database check timed out.")), input.timeoutMs ?? 3000); });
    const check = (async () => {
      const client = await input.getClient();
      if (!client) throw new Error("Database client could not be created.");
      await input.ping(client);
    })();
    await Promise.race([check, timeout]);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database check failed.";
    // Never echo connection strings or credentials.
    return fail(message.replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[redacted-url]").slice(0, 200));
  } finally {
    if (timer) clearTimeout(timer);
  }
}
