export const _sheo_stub = true;

export async function start({host, port}) {
  throw new Error("stub: serve.start");
}

export async function poll({wait}) {
  throw new Error("stub: serve.poll");
}

export function emit(message) {
  throw new Error("stub: serve.emit");
}

export async function close() {
  throw new Error("stub: serve.close");
}
