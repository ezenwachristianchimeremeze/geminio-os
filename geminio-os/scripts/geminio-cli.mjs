#!/usr/bin/env node
import { readFileSync } from "node:fs";

const input = process.argv[2];
if (!input) {
  console.error("Usage: pnpm geminio:generate <request.json>");
  process.exit(2);
}
const request = JSON.parse(readFileSync(input, "utf8"));
if (typeof request.prompt !== "string" || request.prompt.trim().length < 3 || request.prompt.length > 20_000) {
  console.error("Request must include a prompt between 3 and 20000 characters.");
  process.exit(2);
}
console.log(JSON.stringify({
  kind: "geminio.generation.request",
  requestId: `cli-${Date.now()}`,
  prompt: request.prompt.trim(),
  language: typeof request.language === "string" ? request.language : "typescript",
  execution: "review-required",
  note: "Generated code is emitted as a contract request; it is not executed by the CLI.",
}, null, 2));
