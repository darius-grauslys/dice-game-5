import * as server from "../../../edges/game/game_to_server.mjs";
import * as client from "../../../edges/game/game_to_client.mjs";

let _role = null;
let _initialized = false;

export async function initGame(opts, up) {
  const role = opts && opts.role;
  if (role === "server") {
    _role = "server";
    await server.init({ seed: opts.seed }, up);
  } else if (role === "client") {
    _role = "client";
    await client.init({ seat: opts.seat, canvas: opts.canvas }, up);
  } else {
    throw new TypeError("game.initGame: opts.role must be 'server' or 'client'");
  }
  _initialized = true;
}

export async function begin() {
  if (!_initialized) {
    throw new Error("game.begin: not initialised");
  }
  if (_role === "server") {
    return server.begin();
  } else {
    return client.begin();
  }
}
