# AGENTS.md (dice-game-5)

A four-player dice game, built as a tree of nodes joined by edges. You
work on one small piece of it. Your ticket says which, and what done
means. This file says how the pieces fit.

## Layout

```
common/<part>/            shared values: shapes, rng, tables, json, wire, view. Pure: no IO, no time, no randomness
common/index.mjs          re-exports every part (fixed: don't edit)
<path>/<id>/self/         a node's own code; its children sit beside self/
edges/<X>/X_to_Y.mjs      X's edge to its child Y: forwards to Y's surface, nothing else
tests/X_to_Y/             that edge's test: test_X_to_Y.mjs exports _sheo_check()
tools/check.mjs           the check (fixed: don't edit)
tools/browser.mjs         runs code in headless Chromium, for check and sim (fixed: don't edit)
tools/assert.mjs          node:assert/strict for tests that run in the page (fixed)
package.json              the dependencies: three, esbuild, playwright-core (fixed: don't edit)
app/self/main.mjs         the server process's entry (fixed)
app/self/browser.mjs      the page's entry, bundled into /client.js (fixed)
```

- A node's id is the folder above its `self/` (`turn`, `server`, ...).
  Ids never contain `_`.
- Every node has exactly one owner: the one node with an edge into it.
- A node calls its children only through its edges (`edges/<it>/`).
- A node imports `common` (`import { ... } from "<relative path>/common/index.mjs"`),
  its own edges, the installed packages its ticket names (`three`, `esbuild`),
  and Node's built-ins, and nothing else outside its own `self/`. Your ticket
  gives the import lines; import only the names you use.
- `common` is pure values and data: `shapes` (the constructors; an Action's
  move field is `move`, because `kind` is always the value's tag), `rng`,
  `tables` (`FACES`, `ORIENTATIONS`, `TURN`), `json`, `wire` (what the
  network carries) and `view` (the client's geometry).
- Dependencies are installed for you (`.wabbajack/setup`, `npm ci`) where
  `check` and `sim` run. Your own view of the repository doesn't have
  `node_modules`: that's expected. Don't install anything.

## Markers

- `export const _sheo_stub = true` marks a node that is still a stub.
  Implementing the node means removing it.
- `export const _sheo_pending = true` marks an edge test not written yet.
  Writing the test means removing it.
- `export const _sheo_browser = true` in an edge test makes `check` run its
  `_sheo_check()` in headless Chromium (a page with an 800×600 `<canvas>`)
  instead of in Node.

## Checking your work

Run the forwarded `check` (no arguments). It knows which agent you are
and checks your piece: a common part's tests, a node and its edges, or
an edge's test. It prints `ok`, `pending` or `fail` per item, and fails
the commit and the merge request the same way. Run it before you finish.

Your view of the repository is only your piece. `tools/check.mjs` run by
hand there can't see the nodes at the other ends of your edges (it says
so), and `node --test` by hand skips what the gate runs. Use the forwarded
`check`: it runs on the whole tree.

Reviewers: `check as <agent>` runs the check another agent's commits get
(e.g. `check as c-shapes`).

Testing error messages: in Node (and in the page), `assert.throws(fn, /re/)` matches the
regex against `String(error)`, so anchor it as `/^TypeError: Die\.id: /`.

## Seeing it run: the forwarded `sim`

Browser nodes (and app, for the whole game) have a sim: `<node>/self/sim.mjs`,
written with the node. `sim <node>` (e.g. `sim scene`) runs it in headless
Chromium and prints:

- its result;
- the page's console and errors;
- what the canvas shows: how much is drawn, the colours, and a 48×18
  character map (`#` mostly drawn, `+` some, `.` background).

It also saves `out/sim/<node>.png`. `sim <node> <file.json>` passes a
scenario. Your ticket says what the sim must show.

## If the ticket is wrong, or the tools can't do it

If your ticket contradicts itself, or asks for something you can't do
inside your writable paths, don't work around it. The same if the
forwarded `check` and `sim` fail for reasons outside your writable paths,
or don't show you what you need to verify your ticket. Don't build your
own way around them: no hand-run node or browser, no installing anything.
Say so in your final answer on a line starting `STAND-DOWN:`, with the
reason (and what you needed), and end the run.
