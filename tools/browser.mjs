#!/usr/bin/env node
// browser: runs code in headless Chromium, for check and for the forwarded `sim`.
// Fixed by the plan: don't edit.
//
//   browser.mjs check <test.mjs> [--root DIR] [--timeout MS]
//       Bundles the edge test (esbuild), opens it in a page with an 800x600
//       <canvas>, runs its _sheo_check() there, and prints one JSON line:
//       {"ok": true} or {"ok": false, "error": "..."}, plus "console".
//       In the page, `node:assert/strict` is tools/assert.mjs (the common subset).
//       check.mjs uses this for an edge test that exports `_sheo_browser = true`.
//
//   browser.mjs sim <node> [scenario.json] [--root DIR] [--timeout MS]
//       <node> is a node id (scene, pointer, client, app, ...). Two modes:
//       - page mode: <node>/self/sim.mjs runs IN THE PAGE and exports
//           export async function _sheo_sim(canvas, scenario) { ...; return <JSON-able> }
//       - server mode, when <node>/self/sim.server.json exists ({"main", "args"}):
//           the tool starts `node <main> ...args --host 127.0.0.1 --port <free>`,
//           opens <origin>/?seat=0 in the page, and <node>/self/sim.mjs runs IN NODE:
//           export async function _sheo_drive({page, origin, scenario}) { ...; return <JSON-able> }
//       It prints the result, the page's console and errors, and what the canvas
//       shows (coverage, colours, a character map), and saves a screenshot to
//       out/sim/<node>.png.

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT_DEFAULT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const mode = args.shift();
let root = ROOT_DEFAULT, timeout = 60000;
const rest = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--root") root = path.resolve(args[++i]);
  else if (args[i] === "--timeout") timeout = Number(args[++i]);
  else rest.push(args[i]);
}


// ---------------------------------------------------------------- helpers

async function deps() {
  try {
    const esbuild = await import(pathToFileURL(path.join(root, "node_modules/esbuild/lib/main.js")).href);
    const { chromium } = await import(pathToFileURL(path.join(root, "node_modules/playwright-core/index.mjs")).href);
    return { esbuild: esbuild.default ?? esbuild, chromium };
  } catch (e) {
    throw new Error(`browser: the dependencies aren't installed (${String(e.message).split("\n")[0]}). ` +
      "They come from .wabbajack/setup (npm ci) in dev; there is nothing to install by hand.");
  }
}

async function bundle(esbuild, contents) {
  const r = await esbuild.build({
    stdin: { contents, resolveDir: root, sourcefile: "sheo-entry.mjs", loader: "js" },
    bundle: true, format: "esm", platform: "browser", write: false, logLevel: "silent",
    nodePaths: [path.join(root, "node_modules")],
    // tests use node:assert/strict; in the page it is tools/assert.mjs (the same API, the common subset)
    alias: { "node:assert/strict": path.join(path.dirname(fileURLToPath(import.meta.url)), "assert.mjs"),
             "node:assert": path.join(path.dirname(fileURLToPath(import.meta.url)), "assert.mjs") },
  });
  return r.outputFiles[0].text;
}

const PAGE = `<!doctype html><meta charset="utf-8"><title>sheo</title>
<style>html,body{margin:0;background:#202020}canvas{display:block}</style>
<canvas width="800" height="600" style="width:800px;height:600px"></canvas>
<script type="module" src="/entry.js"></script>`;

function serve(js) {
  return new Promise((resolve) => {
    const s = createServer((req, res) => {
      if (req.url === "/" || req.url.startsWith("/?")) { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); }
      else if (req.url === "/entry.js") { res.writeHead(200, { "content-type": "text/javascript" }); res.end(js); }
      else { res.writeHead(404); res.end(); }
    });
    s.listen(0, "127.0.0.1", () => resolve(s));
  });
}

async function launch(chromium) {
  return chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
}

function watch(page) {
  const log = { console: [], errors: [] };
  page.on("console", (m) => log.console.length < 200 && log.console.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => log.errors.push(String((e && e.stack) || e)));
  return log;
}

function nodeDir(id) {
  const found = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (["node_modules", ".git", "edges", "tests", "out", "common", "tools"].includes(name) && dir === root) continue;
      const full = path.join(dir, name);
      if (!statSync(full).isDirectory()) continue;
      if (name === "self") { if (path.basename(dir) === id) found.push(full); continue; }
      walk(full);
    }
  })(root);
  return found[0];
}

function freePort() {
  return new Promise((resolve) => { const s = createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); }); });
}

async function waitUp(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`sim: the server never answered ${url} within ${ms} ms`);
}

// What the canvas shows, from a PNG screenshot, measured in the page itself.
async function look(page, png) {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = new OffscreenCanvas(img.width, img.height);
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    const counts = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    let bg = 0, best = -1;
    for (const [k, n] of counts) if (n > best) { best = n; bg = k; }
    const W = 48, H = 18, cw = img.width / W, ch = img.height / H;
    const cells = Array.from({ length: H }, () => new Array(W).fill(0));
    let drawn = 0;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
      if (k !== bg) { drawn++; cells[Math.floor(y / ch)][Math.floor(x / cw)]++; }
    }
    const per = cw * ch;
    const map = cells.map((r) => r.map((n) => (n / per > 0.3 ? "#" : n / per > 0.05 ? "+" : ".")).join(""));
    const hex = (k) => "#" + [k >> 8, (k >> 4) & 15, k & 15].map((v) => (v * 17).toString(16).padStart(2, "0")).join("");
    const colours = [...counts.entries()].filter(([, n]) => n > d.length / 4 / 1000).length;
    return { width: img.width, height: img.height, background: hex(bg), drawn: drawn / (img.width * img.height), colours, map };
  }, png.toString("base64"));
}

function show(r, max = 6000) {
  const s = JSON.stringify(r, null, 1);
  return s.length > max ? s.slice(0, max) + `\n... (${s.length - max} more characters)` : s;
}

// ---------------------------------------------------------------- modes

async function check(file) {
  let browser, out;
  try {
    const { esbuild, chromium } = await deps();
    const abs = path.resolve(root, file);
    const js = await bundle(esbuild, `import * as m from ${JSON.stringify(abs)};
window.__run = async () => { await m._sheo_check(); return true; };`);
    const s = await serve(js);
    browser = await launch(chromium);
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const log = watch(page);
    await page.goto(`http://127.0.0.1:${s.address().port}/`);
    await page.waitForFunction(() => typeof window.__run === "function", null, { timeout: 20000 });
    try {
      await page.evaluate(() => window.__run());
      out = { ok: log.errors.length === 0, ...(log.errors.length ? { error: "page errors:\n" + log.errors.join("\n") } : {}), console: log.console };
    } catch (e) {
      out = { ok: false, error: String(e.message || e).replace(/^page\.evaluate: /, ""), console: log.console, errors: log.errors };
    }
    s.close();
  } catch (e) {
    out = { ok: false, error: String((e && e.message) || e) };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  console.log(JSON.stringify(out));
  process.exit(out.ok ? 0 : 1);
}

async function sim(id, scenarioFile) {
  if (!id) { console.log("usage: sim <node> [scenario.json]"); process.exit(2); }
  const dir = nodeDir(id);
  if (!dir) { console.log(`sim: no node ${id} (no <path>/${id}/self/)`); process.exit(2); }
  const simFile = path.join(dir, "sim.mjs");
  if (!existsSync(simFile)) { console.log(`sim: ${path.relative(root, simFile)} doesn't exist: the node's sim entry is written with the node`); process.exit(2); }
  let scenario = null;
  if (scenarioFile) scenario = JSON.parse(readFileSync(path.resolve(root, scenarioFile), "utf8"));
  const serverSpec = path.join(dir, "sim.server.json");
  const serverMode = existsSync(serverSpec);
  console.log(`sim: ${id} (${serverMode ? "server" : "page"} mode; scenario: ${scenarioFile || "none"})`);

  const { esbuild, chromium } = await deps();
  let browser, proc, s, code = 0;
  try {
    browser = await launch(chromium);
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const log = watch(page);
    let result;
    if (serverMode) {
      const spec = JSON.parse(readFileSync(serverSpec, "utf8"));
      const port = await freePort();
      const origin = `http://127.0.0.1:${port}`;
      const serverLog = [];
      proc = spawn(process.execPath, [path.resolve(root, spec.main), ...(spec.args || []), "--host", "127.0.0.1", "--port", String(port)], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
      proc.stdout.on("data", (d) => serverLog.push(String(d)));
      proc.stderr.on("data", (d) => serverLog.push(String(d)));
      try { await waitUp(origin + "/", 20000); }
      catch (e) { console.log(String(e.message)); console.log("server output:\n" + serverLog.join("").slice(-3000)); throw e; }
      await page.goto(origin + "/?seat=0");
      const m = await import(pathToFileURL(simFile).href);
      try { result = await m._sheo_drive({ page, origin, scenario }); }
      catch (e) { result = { thrown: String((e && e.stack) || e) }; code = 1; }
      console.log("server output (last 2000 characters):\n" + (serverLog.join("").slice(-2000) || "(none)"));
    } else {
      const js = await bundle(esbuild, `import * as m from ${JSON.stringify(simFile)};
window.__run = async (scenario) => m._sheo_sim(document.querySelector("canvas"), scenario);`);
      s = await serve(js);
      await page.goto(`http://127.0.0.1:${s.address().port}/`);
      await page.waitForFunction(() => typeof window.__run === "function", null, { timeout: 20000 });
      try { result = await page.evaluate((sc) => window.__run(sc), scenario); }
      catch (e) { result = { thrown: String(e.message || e).replace(/^page\.evaluate: /, "") }; code = 1; }
    }
    await new Promise((r) => setTimeout(r, 300));
    const png = await page.locator("canvas").first().screenshot().catch(() => page.screenshot());
    mkdirSync(path.join(root, "out/sim"), { recursive: true });
    writeFileSync(path.join(root, `out/sim/${id}.png`), png);
    const seen = await look(page, png);
    console.log("result:\n" + show(result));
    console.log(`console (${log.console.length}):\n` + (log.console.slice(-50).join("\n") || "(none)"));
    console.log(`page errors (${log.errors.length}):\n` + (log.errors.join("\n") || "(none)"));
    if (log.errors.length) code = 1;
    console.log(`canvas: ${seen.width}x${seen.height}, background ${seen.background}, drawn ${(seen.drawn * 100).toFixed(1)}%, ${seen.colours} colours`);
    console.log("map (48x18; # mostly drawn, + some, . background):\n" + seen.map.join("\n"));
    console.log(`screenshot: out/sim/${id}.png`);
  } catch (e) {
    console.log("sim failed: " + String((e && e.stack) || e));
    code = 1;
  } finally {
    if (s) s.close();
    if (proc) proc.kill("SIGTERM");
    if (browser) await browser.close().catch(() => {});
  }
  process.exit(code);
}

// ---------------------------------------------------------------- run

const timer = setTimeout(() => { console.log(mode === "check" ? JSON.stringify({ ok: false, error: `browser: timed out after ${timeout} ms` }) : `sim: timed out after ${timeout} ms`); process.exit(1); }, timeout);

if (mode === "check") await check(rest[0]);
else if (mode === "sim") await sim(rest[0], rest[1]);
else { console.log("usage: browser.mjs check <test.mjs> | sim <node> [scenario.json]"); process.exit(2); }
clearTimeout(timer);
