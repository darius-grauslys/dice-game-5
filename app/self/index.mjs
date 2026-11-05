// app: the root node. Starts a process and routes by role.
export async function start(opts) {
  const network = await import("../../edges/app/app_to_network.mjs");
  const game = await import("../../edges/app/app_to_game.mjs");
  const up = await network.initNetwork(opts);
  await game.initGame(opts, up);
  await game.begin();
}
