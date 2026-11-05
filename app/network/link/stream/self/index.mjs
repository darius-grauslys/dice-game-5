import { decodeEvents } from "../../../../../common/index.mjs";

export function open(url, onMessage) {
  const controller = new AbortController();
  let buffer = "";
  let closed = false;

  async function run() {
    let response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (e) {
      if (!closed) console.error(e);
      return;
    }
    if (!response.ok) {
      if (!closed) console.error(new Error(`fetch failed: ${response.status} ${response.statusText}`));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const [messages, rest] = decodeEvents(buffer);
        for (const m of messages) {
          if (closed) return;
          onMessage(m);
        }
        buffer = rest;
      }
    } catch (e) {
      if (closed) return;
      console.error(e);
      return;
    }
    if (!closed) {
      console.error(new Error("stream ended before close"));
    }
  }

  run();

  return {
    close() {
      closed = true;
      controller.abort();
    },
  };
}
