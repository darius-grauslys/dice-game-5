import * as esbuild from "esbuild";
import { fileURLToPath } from "node:url";

// The page runs only the client role: the server's transport (network's edge
// to serve, and everything under it) is replaced by a stub in the bundle.
const SERVER_ONLY = /(^|\/)edges\/network\/network_to_serve\.mjs$/;
const STUB = 'export async function start() { throw new Error("network: serve is server only"); }\nexport async function close() {}\n';

const serverOnly = {
  name: "server-only",
  setup(b) {
    b.onResolve({ filter: /network_to_serve\.mjs$/ }, (args) => {
      const p = fileURLToPath(new URL(args.path, "file://" + args.resolveDir + "/"));
      return SERVER_ONLY.test(p) ? { path: p, namespace: "server-only" } : undefined;
    });
    b.onLoad({ filter: /.*/, namespace: "server-only" }, () => ({ contents: STUB, loader: "js" }));
  },
};

const ENTRY = fileURLToPath(new URL("../../../../../app/self/browser.mjs", import.meta.url));

let _cached;

export async function build() {
  if (_cached) return _cached;
  let r;
  try {
    r = await esbuild.build({ entryPoints: [ENTRY], bundle: true, format: "esm", platform: "browser", write: false, logLevel: "silent", plugins: [serverOnly] });
  } catch (e) {
    throw new Error(`bundle.build: ${e.message ?? String(e)}`);
  }
  _cached = r.outputFiles[0].text;
  return _cached;
}
