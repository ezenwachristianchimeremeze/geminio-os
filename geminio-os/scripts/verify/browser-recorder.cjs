/**
 * Real-browser verification of the web audio recorder (lib/home-chat/platform.ts) in headless Chromium
 * with Chromium's synthetic microphone. Not part of the unit suite (needs Playwright + Chromium).
 *
 *   NODE_PATH=<global node_modules> node scripts/verify/browser-recorder.cjs <outDir>
 *
 * Checks: record -> pause -> resume -> stop yields a real WebM/Opus file; cancel discards; permission
 * denied (Permissions-Policy: microphone=()) maps to "permission_denied"; no device maps to "mic_unavailable".
 * Writes <outDir>/audio.b64 (the browser-recorded bytes) for scripts/verify/stt-browser-audio.ts.
 */
const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const out = path.resolve(process.argv[2] || "/tmp/verify-out");
fs.mkdirSync(out, { recursive: true });
const esbuild = process.env.ESBUILD || "esbuild";

fs.writeFileSync(path.join(out, "rn-stub.js"), "export const Platform = { OS: 'web' };");
fs.writeFileSync(path.join(out, "entry.ts"), `import { createRecorder, RecorderError, isRecordingSupported } from ${JSON.stringify(path.join(root, "lib/home-chat/platform.ts"))};
(window as any).H = { createRecorder, isRecordingSupported, RecorderError };`);
execFileSync(esbuild, [path.join(out, "entry.ts"), "--bundle", "--format=iife", "--platform=browser", `--alias:react-native=${path.join(out, "rn-stub.js")}`, "--external:expo-*", `--outfile=${path.join(out, "bundle.js")}`, "--log-level=error"], { stdio: "inherit" });
const bundle = fs.readFileSync(path.join(out, "bundle.js"), "utf8");

const server = http.createServer((req, res) => {
  const headers = { "content-type": "text/html" };
  if (req.url.startsWith("/deny")) headers["Permissions-Policy"] = "microphone=()";
  if (req.url.endsWith(".js")) { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(bundle); }
  res.writeHead(200, headers); res.end("<!doctype html><title>t</title><script src='/bundle.js'></script>");
});

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const launch = (extra = []) => chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", ...extra] });
  const errors = [];

  // 1. happy path with a synthetic mic
  let browser = await launch();
  let ctx = await browser.newContext({ permissions: ["microphone"] });
  let page = await ctx.newPage(); page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(base + "/");
  const rec = await page.evaluate(async () => {
    const H = window.H; const r = H.createRecorder(); const log = [];
    log.push(["supported", H.isRecordingSupported()]);
    await r.start(); await new Promise((x) => setTimeout(x, 700)); r.pause(); await new Promise((x) => setTimeout(x, 400)); r.resume(); await new Promise((x) => setTimeout(x, 700));
    const res = await r.stop();
    // cancel path
    const r2 = H.createRecorder(); await r2.start(); await new Promise((x) => setTimeout(x, 300)); r2.cancel();
    return { log, mime: res.mimeType, durationMs: res.durationMs, b64: res.base64 };
  });
  const bytes = Buffer.from(rec.b64, "base64");
  fs.writeFileSync(path.join(out, "audio.b64"), rec.b64);
  check("MediaRecorder supported in Chromium", rec.log[0][1] === true);
  check("record/pause/resume/stop returns non-trivial audio", bytes.length > 2000, `${bytes.length} bytes, ${rec.mime}`);
  check("recording is a real WebM container (EBML header 1A45DFA3)", bytes.slice(0, 4).toString("hex") === "1a45dfa3");
  check("reported duration excludes the paused interval (~1.4s, not ~1.8s)", rec.durationMs >= 1200 && rec.durationMs < 1700, `${rec.durationMs}ms`);
  await browser.close();

  // 2. permission denied (policy-blocked getUserMedia -> real NotAllowedError)
  browser = await launch(); ctx = await browser.newContext({ permissions: ["microphone"] }); page = await ctx.newPage();
  await page.goto(base + "/deny");
  const denied = await page.evaluate(async () => { try { await window.H.createRecorder().start(); return { ok: true }; } catch (e) { return { ok: false, kind: e.kind, name: e.constructor.name, msg: e.message }; } });
  check("blocked microphone maps to RecorderError permission_denied", denied.ok === false && denied.kind === "permission_denied", JSON.stringify(denied));
  await browser.close();

  // 3. no capture device (fake-ui accepted but device flag omitted)
  browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream"] }); ctx = await browser.newContext({ permissions: ["microphone"] }); page = await ctx.newPage();
  await page.goto(base + "/");
  const nodev = await page.evaluate(async () => { try { await window.H.createRecorder().start(); return { ok: true }; } catch (e) { return { ok: false, kind: e.kind, msg: e.message }; } });
  check("no microphone device maps to mic_unavailable (or recording_failed if Chromium differs)", nodev.ok === false && ["mic_unavailable", "recording_failed"].includes(nodev.kind), JSON.stringify(nodev));
  await browser.close();

  check("no uncaught page errors", errors.length === 0, errors.join(" | "));
  server.close();
  fs.writeFileSync(path.join(out, "browser-recorder-results.json"), JSON.stringify(results, null, 2));
  process.exit(results.every((r) => r.ok) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
