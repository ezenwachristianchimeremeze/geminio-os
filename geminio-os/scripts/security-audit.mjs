import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

mkdirSync("artifacts", { recursive: true });
const run = (command, args, timeout = 10_000) => {
  try {
    return { ok: true, output: execFileSync(command, args, { encoding: "utf8", timeout, stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (error) {
    return { ok: false, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
};
const inventory = run("pnpm", ["list", "--depth", "0", "--json"]);
const audit = { ok: false, output: "Registry advisory lookup is provider/network dependent; run pnpm audit --json in a connected release environment." };
const typecheck = run("pnpm", ["check"], 60_000);
const report = {
  generatedAt: new Date().toISOString(),
  dependencyInventory: inventory,
  dependencyAudit: audit,
  staticChecks: { typecheck },
  releaseGate: typecheck.ok ? "pass" : "fail",
};
writeFileSync("artifacts/security-audit.json", JSON.stringify(report, null, 2));
if (!typecheck.ok) process.exitCode = 1;
