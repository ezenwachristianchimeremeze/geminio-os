import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { runAiWorkerOnce } from "../ai-core/orchestrator";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { evaluateDatabaseHealth } from "./health";

function isTrustedOrigin(origin: string): boolean {
  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (configuredOrigins.includes(origin)) return true;
  try {
    const url = new URL(origin);
    const isLocalDevelopment = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const isManusPreview = url.protocol === "https:" && (url.hostname.endsWith(".manus.computer") || url.hostname.endsWith(".manus.space"));
    return isLocalDevelopment || isManusPreview;
  } catch {
    return false;
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Permit credentialed cross-origin requests only from configured, local, or managed preview origins.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && isTrustedOrigin(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
    } else if (origin) {
      res.status(403).json({ ok: false, error: "Cross-origin request is not allowed." });
      return;
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Readiness: process is up AND its dependencies answer. 503 when the database is not usable.
  app.get("/api/health/ready", async (_req, res) => {
    const db = await evaluateDatabaseHealth({
      databaseUrl: process.env.DATABASE_URL,
      getClient: () => getDb(),
      ping: (client) => (client as { execute: (q: unknown) => Promise<unknown> }).execute(sql`select 1`),
      nodeEnv: process.env.NODE_ENV,
    });
    res.status(db.ok ? 200 : 503).json({ ok: db.ok, timestamp: Date.now(), db });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
    let workerTickInProgress = false;
    const runWorkerTick = async () => {
      if (workerTickInProgress) return;
      workerTickInProgress = true;
      try {
        await runAiWorkerOnce();
      } catch (error) {
        console.error("[ai-core] worker tick failed", error);
      } finally {
        workerTickInProgress = false;
      }
    };
    void runWorkerTick();
    const workerTimer = setInterval(() => { void runWorkerTick(); }, 5000);
    void workerTimer;
    // Retention: temporary Home chats are actually deleted (rows + messages) once older than the stated retention window.
    const sweep = async () => {
      try {
        const { getMysqlConversationStore } = await import("../home-chat/mysql-store");
        const { sweepTemporaryConversations } = await import("../home-chat/conversations");
        const n = await sweepTemporaryConversations(await getMysqlConversationStore());
        if (n > 0) console.log(`[home-chat] deleted ${n} expired temporary conversation(s)`);
      } catch (error) { console.error("[home-chat] temporary-chat sweep failed", error instanceof Error ? error.message : error); }
    };
    const reconcile = async () => {
      try {
        const { reconcileUnsettledReservations } = await import("../credits/mysql-store");
        const n = await reconcileUnsettledReservations();
        if (n > 0) console.log(`[credits] reconciled ${n} unsettled reservation(s)`);
      } catch (error) { console.error("[credits] reconciliation failed", error instanceof Error ? error.message : error); }
    };
    setInterval(() => { void reconcile(); }, 60_000);
    let scheduleTickRunning = false;
    setInterval(() => {
      if (scheduleTickRunning) return; scheduleTickRunning = true;
      void import("../home-chat/service").then((m) => m.runScheduleTick()).then((r) => { if (r.fired || r.failed || r.recovered || r.retried) console.log(`[schedules] fired=${r.fired} recovered=${r.recovered} retried=${r.retried} failed=${r.failed} skipped=${r.skipped}`); }).catch((e) => console.error("[schedules] tick failed", e instanceof Error ? e.message : e)).finally(() => { scheduleTickRunning = false; });
    }, 30_000);
    setInterval(() => { void import("../ai-core/orchestrator").then((m) => m.expirePausedRuns()).then((n) => { if (n > 0) console.log(`[ai-core] cancelled ${n} expired paused run(s)`); }).catch((e) => console.error("[ai-core] paused-run expiry failed", e instanceof Error ? e.message : e)); }, 10 * 60_000);
    setTimeout(() => { void sweep(); }, 30_000);
    setInterval(() => { void sweep(); }, 60 * 60_000);
  });
}

startServer().catch(console.error);
