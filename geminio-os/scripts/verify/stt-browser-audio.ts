/**
 * Pushes the audio recorded by real Chromium (scripts/verify/browser-recorder.cjs -> <dir>/audio.b64)
 * through the real transcribe() + WhisperHttpProvider to a local multipart-capturing server, and checks
 * the exact browser-recorded bytes arrive. The "provider" is a local stand-in; no real STT service is verified.
 *   npx tsx scripts/verify/stt-browser-audio.ts <dir-with-audio.b64>
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { transcribe, WhisperHttpProvider } from "../../server/home-chat/stt";

const dir = path.resolve(process.argv[2] ?? "/tmp/verify-out");
const b64 = fs.readFileSync(path.join(dir, "audio.b64"), "utf8");
const original = Buffer.from(b64, "base64");
let captured: Buffer | null = null; let auth = "";
const server = http.createServer((req, res) => {
  const chunks: Buffer[] = []; req.on("data", (c) => chunks.push(c));
  req.on("end", () => { captured = Buffer.concat(chunks); auth = String(req.headers.authorization); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ text: "local stand-in transcript", language: "en", duration: 1.4, segments: [] })); });
});
server.listen(0, "127.0.0.1", async () => {
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const out = await transcribe(new WhisperHttpProvider({ baseUrl: base, apiKey: "k", model: "whisper-1" }), { audioBase64: b64, mimeType: "audio/webm;codecs=opus" });
  const arrived = captured !== null && (captured as Buffer).includes(original);
  const header = (captured as Buffer | null)?.toString("latin1") ?? "";
  const checks: [string, boolean][] = [
    ["transcribe() returned ok", out.status === "ok"],
    ["multipart body contains the exact browser-recorded bytes", arrived],
    ["part is named audio.webm with model field", header.includes('filename="audio.webm"') && header.includes("whisper-1")],
    ["bearer auth header sent", auth === "Bearer k"],
  ];
  for (const [n, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${n}`);
  console.log(`(${original.length} bytes of WebM sent)`);
  server.close(); process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
});
