// app's page entry (fixed by the plan; don't edit). serve's bundle builds this file.
import { start } from "./index.mjs";

const seat = Number(new URLSearchParams(location.search).get("seat") ?? 0);
start({ role: "client", seat, canvas: document.querySelector("canvas"), origin: location.origin })
  .catch((e) => console.error(e));
