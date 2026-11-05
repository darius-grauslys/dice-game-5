import { test } from "node:test";
import assert from "node:assert/strict";
import * as serve from "../index.mjs";

test("emit ignores non-message", () => {
  serve.emit({ kind: "not-a-message" });
  serve.emit(null);
  serve.emit(undefined);
  serve.emit({ kind: "message", type: "other", body: {} });
});
