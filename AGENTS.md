# AGENTS.md (dice-game-5)

A four-player dice game, built as a tree of nodes joined by edges. You
work on one small piece of it. Your ticket says which, and what done
means. This file says how the pieces fit.

## Layout

```
common/<part>/            shared values: shapes, rng, tables, json. Pure: no IO, no time, no randomness
common/index.mjs          re-exports every part (fixed: don't edit)
<path>/<id>/self/         a node's own code; its children sit beside self/
edges/<X>/X_to_Y.mjs      X's edge to its child Y: forwards to Y's surface, nothing else
tests/X_to_Y/             that edge's test: test_X_to_Y.mjs exports _sheo_check()
tools/check.mjs           the check (fixed: don't edit)
```

- A node's id is the folder above its `self/` (`turn`, `server`, ...).
  Ids never contain `_`.
- Every node has exactly one owner: the one node with an edge into it.
- A node calls its children only through its edges (`edges/<it>/`).
- A node imports `common` (`import { ... } from "<relative path>/common/index.mjs"`),
  and nothing else outside its own `self/` and its edges. Your ticket gives
  the exact import lines.
- `common` is pure values and data: `shapes` (the constructors; an Action's
  move field is `move`, because `kind` is always the value's tag), `rng`,
  `tables` (`FACES`, `ORIENTATIONS`, `TURN`) and `json`.

## Markers

- `export const _sheo_stub = true` marks a node that is still a stub.
  Implementing the node means removing it.
- `export const _sheo_pending = true` marks an edge test not written yet.
  Writing the test means removing it.

## Checking your work

Run the forwarded `check` (no arguments). It knows which agent you are
and checks your piece: a common part's tests, a node and its edges, or
an edge's test. It prints `ok`, `pending` or `fail` per item, and fails
the commit and the merge request the same way. Run it before you finish.

Don't run `node --test` or `tools/check.mjs` by hand in place of it:
`check` is what the gate runs.

Reviewers: `check as <agent>` runs the check another agent's commits get
(e.g. `check as c-shapes`).

Testing error messages: on Node 24, `assert.throws(fn, /re/)` matches the
regex against `String(error)`, so anchor it as `/^TypeError: Die\.id: /`.

## If the ticket is wrong

If your ticket contradicts itself, or asks for something you can't do
inside your writable paths, don't work around it. Say so in your final
answer on a line starting `STAND-DOWN:`, with the reason, and end the run.
