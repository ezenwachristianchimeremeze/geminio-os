/** Print matrix-derived progress (same code the Preview panel uses). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bar, computeProgress } from "../server/dev-preview/progress";

const report = computeProgress(readFileSync(join(process.cwd(), "BLUEPRINT_IMPLEMENTATION_MATRIX.md"), "utf8"));
const line = (a: (typeof report.areas)[number]) =>
  `${a.area.padEnd(20)} built ${bar(a.builtPercent)} ${String(a.builtPercent).padStart(3)}%   verified ${bar(a.verifiedPercent)} ${String(a.verifiedPercent).padStart(3)}%   (${a.counts.missing} missing, ${a.counts.in_progress} in progress, ${a.counts.implemented} implemented, ${a.counts.verified} verified, ${a.counts.blocked} blocked)`;
console.log(line(report.overall));
console.log("-".repeat(110));
for (const a of report.areas) console.log(line(a));
if (report.problems.length) { console.error("\nMatrix integrity problems:\n" + report.problems.join("\n")); process.exit(1); }
