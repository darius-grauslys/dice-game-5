import * as esbuild from "esbuild";
import { fileURLToPath } from "node:url";

const ENTRY = fileURLToPath(new URL("../../../../../app/self/browser.mjs", import.meta.url));

let _cached;

export async function build() {
  if (_cached) return _cached;
  let r;
  try {
    r = await esbuild.build({ entryPoints: [ENTRY], bundle: true, format: "esm", platform: "browser", write: false, logLevel: "silent" });
  } catch (e) {
    throw new Error(`bundle.build: ${e.message ?? String(e)}`);
  }
  _cached = r.outputFiles[0].text;
  return _cached;
}
