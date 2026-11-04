// app's server entry (fixed by the plan; don't edit):
//   node app/self/main.mjs [--seed S] [--port P] [--host H]
import { start } from "./index.mjs";

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
}

await start({ role: "server", seed: Number(arg("seed", 1)), port: Number(arg("port", 8080)), host: arg("host", "127.0.0.1") });
