#!/usr/bin/env node
// tools/sheo-bridge.mjs: dice-game-5's bridge from tools/check.mjs to sheo-check's payload.
//
// One category, "check". A test id is an agent name (n-<node>, t-<edge>, s-<edge>,
// c-<part>), or "tree" for the whole tree; running it is check.mjs keyed on that
// agent, exactly as the old .githooks/project-checks did with SHEO_AGENT.
//
//   get <pattern...>   each pattern is an agent name: it is its own id
//   get                every id: "tree"
//   run <id...>        check.mjs --agent <id> for each (none: "tree")
//
// stdout is only the payload; check.mjs's own output goes to stderr (sheo-check keeps it).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = path.join(ROOT, "tools", "check.mjs");
// check.mjs's per-child timeout; browser tests get twice this. The scene edge test holds several phases'
// checks and real particles make headless frames slow: 60 s (the default 30 s × 2) was no longer enough.
const TIMEOUT_MS = "90000";
const ID = /^(tree|[ntsc]-[A-Za-z0-9_-]+)$/;
const [verb, ...args] = process.argv.slice(2);
const print = (o) => process.stdout.write(JSON.stringify(o) + "\n");

if (verb === "get") {
  const bad = args.filter((a) => !ID.test(a));
  if (bad.length) { console.error(`sheo-bridge: not an agent id: ${bad.join(", ")}`); process.exit(2); }
  print({ tests: (args.length ? args : ["tree"]).map((id) => ({ id })) });
  process.exit(0);
}
if (verb !== "run") { console.error("usage: sheo-bridge.mjs get|run [ids...]"); process.exit(2); }

const tests = [], texts = [];
for (const id of args.length ? args : ["tree"]) {
  if (!ID.test(id)) { tests.push({ id, status: "error", message: "not an agent id" }); continue; }
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [CHECK, "--root", ROOT, "--timeout", TIMEOUT_MS, ...(id === "tree" ? [] : ["--agent", id])],
                      { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
  const out = (r.stdout || "") + (r.stderr || "");
  process.stderr.write(`--- check ${id}\n${out}`);
  const status = r.status === 0 ? "passed" : r.status === 1 ? "failed" : "error";
  const fails = out.split("\n").filter((l) => /^fail\s/.test(l));
  const summary = out.split("\n").filter((l) => l.startsWith("check: ")).pop() || `exit ${r.status ?? r.signal}`;
  tests.push({ id, status, duration: (Date.now() - t0) / 1000,
               ...(status === "passed" ? {} : { message: [summary, ...fails].join("\n") }) });
  if (status !== "passed") texts.push(`check ${id} ${status}: ${summary}\n${failures(out) || out.slice(-2500)}`);
}
print({ tests, ...(texts.length ? { agent: texts.join("\n\n") +
  "\n\nRun the forwarded `check` to see this again; fix what it names in your scope, or stand down if it is outside it." } : {}) });
process.exit(tests.every((t) => t.status === "passed") ? 0 : 1);

// check.mjs's failures: each `fail` line and the indented detail under it (capped).
function failures(out) {
  const keep = [];
  let on = false;
  for (const l of out.split("\n")) {
    if (/^fail\s/.test(l)) on = true;
    else if (!/^\s/.test(l)) on = false;
    if (on) keep.push(l);
  }
  return keep.join("\n").slice(0, 3000);
}
