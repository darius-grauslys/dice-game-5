#!/usr/bin/env node
// check: the project's agent-keyed check over its tree's edges.
//
// sheo-stack only calls this (the forwarded `check` and .githooks/project-checks);
// everything it knows is the project's own layout:
//
//   <path>/<id>/self/index.mjs      a node; its id is the folder above self/
//   edges/<X>/<X>_to_<Y>.mjs        X's edge to Y: the no-op forwarder
//   tests/<X>_to_<Y>/test_<X>_to_<Y>.mjs
//                                   the edge's test; exports _sheo_check()
//
// Markers the scaffold writes: `export const _sheo_stub = true` in a node's
// stub (the implementation removes it), and `export const _sheo_pending = true`
// in an edge's test (the test writer removes it).
//
// The agent (--agent, else $SHEO_AGENT, else /etc/sheo/scope/agent):
//   n-<X>          X's structure (exactly one in-edge, unless X is root; its
//                  out-edges), X is no longer a stub, and the behaviour of its
//                  in-edge and out-edges where nothing is pending or a stub
//   t-<X>_to_<Y>   that edge's test is written: it imports, exports
//                  _sheo_check() and is no longer pending. The test is run
//                  and its result printed ("red" when it fails), but a
//                  failure doesn't fail the check: a test may be written
//                  before the code it tests changes (or exists: stubs under
//                  Y are fine), and the code's own ticket is what must pass it
//   s-<X>_to_<Y>   that edge's scaffold: forwarder, Y's stub, the test placeholder
//   c-<part>       common/<part>: its tests (common/<part>/**/*.test.mjs, node --test);
//                  at least one must exist
// n-<X> also runs X's own tests (<X>/self/**/*.test.mjs), when it has any.
// --agent overrides the agent (the forwarded `check as <agent>`, for reviewers:
// the gate itself always keys on the real agent).
//   anything else, or none: every node and edge; stubs and pending are reported,
//                  not failed
//
// Each import and each _sheo_check() runs in its own child process with a
// timeout, so a test that leaves a server open (or hangs) fails instead of
// hanging the check. An edge test that exports `_sheo_browser = true` runs its
// _sheo_check() in headless Chromium instead (tools/browser.mjs check).
//
// Run where only part of the tree is visible (an agent's harness), the check
// can't see the nodes at the other ends of edges; it says so and points to the
// forwarded `check`, which runs on the whole tree.
//
// Usage: check.mjs [--agent A] [--root DIR] [--timeout MS] [paths...]
// (paths are accepted from project_checks and ignored). Exit 1 on any failure.

import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SELF = fileURLToPath(import.meta.url);
const SKIP = new Set([".git", "node_modules", "edges", "tests", "out", "dist", "common", ".wabbajack", ".githooks"]);
const ID = /^[A-Za-z0-9-]+$/; // no "_": it separates an edge's ends
const AGENT_FILE = "/etc/sheo/scope/agent";

// ---- child mode: import (and maybe run) one file, report JSON on stdout ----

if (process.argv[2] === "--child") {
  const [, , , mode, file] = process.argv;
  const out = (o) => process.stdout.write(JSON.stringify(o) + "\n", () => process.exit(0));
  try {
    const m = await import(pathToFileURL(file).href);
    const exports = Object.keys(m);
    const flags = { stub: m._sheo_stub === true, pending: m._sheo_pending === true, browser: m._sheo_browser === true };
    if (mode === "probe") {
      out({ ok: true, exports, ...flags, checkFn: typeof m._sheo_check === "function" });
    } else {
      await m._sheo_check();
      out({ ok: true });
    }
  } catch (e) {
    out({ ok: false, error: (e && e.stack) || String(e) });
  }
} else {
  await main();
}

function child(mode, file, timeout) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [SELF, "--child", mode, file], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => (stderr += d));
    const t = setTimeout(() => p.kill("SIGKILL"), timeout);
    p.on("close", (code, signal) => {
      clearTimeout(t);
      if (signal === "SIGKILL") return resolve({ ok: false, error: `timed out after ${timeout} ms (left running or never returned)`, stderr });
      const line = stdout.trim().split("\n").pop();
      try { resolve({ ...JSON.parse(line), stderr }); }
      catch { resolve({ ok: false, error: `exited ${code} without a result`, stderr: stderr + stdout }); }
    });
  });
}

// ---- the tree ----

function findNodes(root) {
  const nodes = new Map(), dupes = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name) && dir === root) continue;
      if (name === "node_modules" || name === ".git") continue;
      const full = path.join(dir, name);
      if (!statSync(full).isDirectory()) continue;
      if (name === "self") {
        const index = path.join(full, "index.mjs");
        if (existsSync(index)) {
          const id = path.basename(dir);
          if (nodes.has(id)) dupes.push(id); else nodes.set(id, index);
        }
        continue; // a node's own code; its children are beside self/
      }
      walk(full);
    }
  })(root);
  return { nodes, dupes };
}

function findEdges(root) {
  const edges = [], strays = [];
  const dir = path.join(root, "edges");
  if (!existsSync(dir)) return { edges, strays };
  for (const from of readdirSync(dir)) {
    if (from.startsWith(".")) continue;
    const sub = path.join(dir, from);
    if (!statSync(sub).isDirectory()) { strays.push(`edges/${from}`); continue; }
    for (const f of readdirSync(sub)) {
      if (f.startsWith(".")) continue; // .keep: a folder made up front so its agent's scope exists
      const m = f.match(/^([A-Za-z0-9-]+)_to_([A-Za-z0-9-]+)\.mjs$/);
      if (!m || m[1] !== from) { strays.push(`edges/${from}/${f}`); continue; }
      const name = `${m[1]}_to_${m[2]}`;
      edges.push({ name, from: m[1], to: m[2], forwarder: path.join(sub, f), test: path.join(root, "tests", name, `test_${name}.mjs`) });
    }
  }
  return { edges, strays };
}

// ---- main ----

async function main() {
  const args = process.argv.slice(2);
  let agent, root = process.cwd(), timeout = Number(process.env.CHECK_TIMEOUT_MS) || 30000;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--agent") agent = args[++i];
    else if (args[i] === "--root") root = path.resolve(args[++i]);
    else if (args[i] === "--timeout") timeout = Number(args[++i]);
  }
  if (agent === undefined) agent = process.env.SHEO_AGENT;
  if (agent === undefined && existsSync(AGENT_FILE)) agent = readFileSync(AGENT_FILE, "utf8").trim();
  agent = agent || "";

  const results = []; // ok, pending, fail; and red (a t- test that fails: printed, not failed)
  const say = (state, what, detail = "") => {
    results.push(state);
    console.log(`${state.padEnd(7)} ${what}${detail ? `: ${detail}` : ""}`);
  };

  const { nodes, dupes } = findNodes(root);
  const { edges, strays } = findEdges(root);
  for (const id of dupes) say("fail", `node ${id}`, "two nodes share this id");
  for (const id of nodes.keys()) if (!ID.test(id)) say("fail", `node ${id}`, "ids may not contain _ (it separates an edge's ends)");
  for (const s of strays) say("fail", s, "not edges/<X>/<X>_to_<Y>.mjs");
  const hidden = edges.some((e) => !nodes.has(e.from) || !nodes.has(e.to));
  if (hidden && existsSync(AGENT_FILE)) {
    console.log("check: only part of the tree is visible here (edges name nodes this tree doesn't have).\n" +
      "This is an agent's view, not the project: run the forwarded `check` (no arguments), which runs on the whole tree.\n" +
      "Running tools/check.mjs by hand here can't pass, and its failures say nothing about your work.");
    process.exit(1);
  }
  for (const e of edges) {
    if (!nodes.has(e.from)) say("fail", `edge ${e.name}`, `no node ${e.from} (no ${e.from}/self/index.mjs)`);
    if (!nodes.has(e.to)) say("fail", `edge ${e.name}`, `no node ${e.to} (no ${e.to}/self/index.mjs)`);
  }
  const inEdges = (id) => edges.filter((e) => e.to === id);
  const outEdges = (id) => edges.filter((e) => e.from === id);
  const roots = [...nodes.keys()].filter((id) => inEdges(id).length === 0);

  const probes = new Map();
  const probe = async (file) => {
    if (!probes.has(file)) probes.set(file, existsSync(file) ? await child("probe", file, timeout) : { ok: false, missing: true });
    return probes.get(file);
  };
  const rel = (f) => path.relative(root, f);

  // A folder's own tests (**/*.test.mjs, node --test); false when it has none.
  async function ownTests(dir, what) {
    const tests = listTests(dir).map(rel);
    if (!tests.length) return false;
    const r = await run(process.execPath, ["--test", `--test-timeout=${timeout}`, ...tests], root, timeout * 2);
    if (r.code === 0) say("ok", what, `${tests.length} test file(s) passed`);
    else say("fail", what, `${r.timedOut ? "timed out" : `node --test exited ${r.code}`}:\n${indent(r.out.split("\n").filter((l) => !/^\s+at /.test(l)).join("\n"))}`);
    return true;
  }

  async function nodeStructure(id) {
    const ins = inEdges(id);
    if (ins.length > 1) say("fail", `node ${id}`, `${ins.length} in-edges (${ins.map((e) => e.name).join(", ")}); the One-Edge Rule allows one owner`);
    if (ins.length === 0 && roots.length !== 1) say("fail", `node ${id}`, `no in-edge, and it isn't the only root (roots: ${roots.join(", ")})`);
    const p = await probe(nodes.get(id));
    if (!p.ok) say("fail", `node ${id}`, `${rel(nodes.get(id))} doesn't import: ${firstLine(p.error)}`);
    return p;
  }

  async function edgeStructure(e) {
    let good = true;
    const f = await probe(e.forwarder);
    if (!f.ok) { good = false; say("fail", `edge ${e.name}`, `forwarder ${rel(e.forwarder)} doesn't import: ${firstLine(f.error)}`); }
    const t = await probe(e.test);
    if (t.missing) { good = false; say("fail", `edge ${e.name}`, `no test at ${rel(e.test)}`); }
    else if (!t.ok) { good = false; say("fail", `edge ${e.name}`, `test doesn't import: ${firstLine(t.error)}`); }
    else if (!t.checkFn) { good = false; say("fail", `edge ${e.name}`, `${rel(e.test)} exports no _sheo_check function`); }
    if (good) say("ok", `edge ${e.name}`, "structure");
    return { good, pending: t.ok && t.pending };
  }

  // Ids under (and including) id that are still stubs.
  async function stubsBelow(id, seen = new Set()) {
    if (seen.has(id) || !nodes.has(id)) return [];
    seen.add(id);
    const p = await probe(nodes.get(id));
    const own = p.ok && p.stub ? [id] : [];
    const kids = await Promise.all(outEdges(id).map((e) => stubsBelow(e.to, seen)));
    return own.concat(...kids);
  }

  // A t- agent's edge: the test is written (structure, not pending); its
  // run is reported, never failed.
  async function edgeWritten(e) {
    const s = await edgeStructure(e);
    if (!s.good) return;
    if (s.pending) { say("fail", `edge ${e.name}`, "its test is still _sheo_pending: writing it removes the marker"); return; }
    const stubs = await stubsBelow(e.to);
    const t = await probe(e.test);
    const r = t.browser ? await inBrowser(e.test) : await child("run", e.test, timeout);
    const where = t.browser ? " (in Chromium)" : "";
    const against = stubs.length ? ` (still stubs under ${e.to}: ${stubs.join(", ")})` : "";
    if (r.ok) say("ok", `edge ${e.name}`, `_sheo_check passed${where}${against}`);
    else say("red", `edge ${e.name}`, `_sheo_check fails against the current code${where}${against}; ` +
      `not a failure of this check (the code's ticket must pass it):\n${indent(r.error)}` +
      `${r.stderr ? `\n  stderr:\n${indent(r.stderr)}` : ""}`);
  }

  async function edgeBehaviour(e, { strict }) {
    const s = await edgeStructure(e);
    if (!s.good) return;
    if (s.pending) {
      if (strict) say("fail", `edge ${e.name}`, "its test is still _sheo_pending");
      else say("pending", `edge ${e.name}`, "test not written yet");
      return;
    }
    const stubs = await stubsBelow(e.to);
    if (stubs.length) {
      if (strict) say("fail", `edge ${e.name}`, `ran too early: still stubs under ${e.to}: ${stubs.join(", ")}`);
      else say("pending", `edge ${e.name}`, `waits on ${stubs.join(", ")}`);
      return;
    }
    const t = await probe(e.test);
    const r = t.browser ? await inBrowser(e.test) : await child("run", e.test, timeout);
    if (r.ok) say("ok", `edge ${e.name}`, `_sheo_check passed${t.browser ? " (in Chromium)" : ""}`);
    else say("fail", `edge ${e.name}`, `_sheo_check failed:\n${indent(r.error)}${r.stderr ? `\n  stderr:\n${indent(r.stderr)}` : ""}`);
  }

  // An edge test marked _sheo_browser: its _sheo_check() runs in a page (tools/browser.mjs).
  async function inBrowser(file) {
    const tool = path.join(path.dirname(SELF), "browser.mjs");
    const r = await run(process.execPath, [tool, "check", rel(file), "--root", root, "--timeout", String(timeout * 2)], root, timeout * 3);
    const line = r.out.trim().split("\n").pop();
    try {
      const o = JSON.parse(line);
      const tail = o.console && o.console.length ? `\n  console:\n${indent(o.console.slice(-20).join("\n"))}` : "";
      return { ok: o.ok, error: (o.error || "") + tail };
    } catch { return { ok: false, error: `tools/browser.mjs gave no result (exit ${r.code}${r.timedOut ? ", timed out" : ""}):\n${r.out.slice(-2000)}` }; }
  }

  const byName = (name) => edges.find((e) => e.name === name);
  let m;
  if ((m = agent.match(/^n-([A-Za-z0-9-]+)$/)) && nodes.has(m[1])) {
    const id = m[1];
    console.log(`check: node ${id} (agent ${agent})`);
    const p = await nodeStructure(id);
    if (p.ok && p.stub) say("fail", `node ${id}`, "still _sheo_stub: the implementation removes the marker");
    else if (p.ok) say("ok", `node ${id}`, "implemented");
    await ownTests(path.dirname(nodes.get(id)), `node ${id}`);
    for (const e of [...inEdges(id), ...outEdges(id)]) await edgeBehaviour(e, { strict: false });
  } else if ((m = agent.match(/^t-(.+)$/)) && byName(m[1])) {
    const e = byName(m[1]);
    console.log(`check: edge test ${e.name} (agent ${agent})`);
    await edgeWritten(e);
  } else if ((m = agent.match(/^s-(.+)$/)) && byName(m[1])) {
    const e = byName(m[1]);
    console.log(`check: edge scaffold ${e.name} (agent ${agent})`);
    await nodeStructure(e.to);
    await edgeStructure(e);
  } else if ((m = agent.match(/^c-([A-Za-z0-9-]+)$/)) && existsSync(path.join(root, "common", m[1]))) {
    const part = m[1];
    console.log(`check: common/${part} (agent ${agent})`);
    if (!(await ownTests(path.join(root, "common", part), `common/${part}`))) say("fail", `common/${part}`, "no tests (common/<part>/**/*.test.mjs)");
  } else {
    if (agent && /^[ntsc]-/.test(agent)) say("fail", `agent ${agent}`, "names no node or edge in this tree");
    console.log(`check: the whole tree${agent ? ` (agent ${agent})` : ""}`);
    if (nodes.size === 0) say("fail", "tree", "no nodes found (<id>/self/index.mjs)");
    if (roots.length !== 1) say("fail", "tree", `${roots.length} roots (${roots.join(", ") || "none"}): want exactly one`);
    for (const id of nodes.keys()) {
      const p = await nodeStructure(id);
      if (p.ok) say(p.stub ? "pending" : "ok", `node ${id}`, p.stub ? "stub" : "implemented");
    }
    for (const e of edges) await edgeBehaviour(e, { strict: false });
  }

  const n = (s) => results.filter((r) => r === s).length;
  const red = n("red") ? `, ${n("red")} red (a written test the code doesn't pass yet: not a failure here)` : "";
  console.log(`\ncheck: ${n("ok")} ok, ${n("pending")} pending, ${n("fail")} failed${red}`);
  process.exit(n("fail") ? 1 : 0);
}

function listTests(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listTests(full));
    else if (name.endsWith(".test.mjs")) out.push(full);
  }
  return out.sort();
}

function run(cmd, argv, cwd, timeout) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT; // set when check itself runs under node --test: the child would report to it and exit 0
    const p = spawn(cmd, argv, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    const t = setTimeout(() => p.kill("SIGKILL"), timeout);
    p.on("close", (code, signal) => { clearTimeout(t); resolve({ code, out, timedOut: signal === "SIGKILL" }); });
  });
}

function firstLine(s) { return String(s || "").split("\n")[0]; }
function indent(s) { return String(s).trimEnd().split("\n").map((l) => "    " + l).join("\n"); }
