import { JevError } from "./errors.js";
export type Fetch = typeof globalThis.fetch;
const maxBytes = 1048576;
// Buffer a bounded body before the SDK's JSON parser, including chunked responses.
export function boundedFetch(fetch: Fetch, signal: AbortSignal): Fetch {
  return async (input, init) => {
    const response = await fetch(input, { ...init, signal, redirect: "error" });
    const reader = response.body?.getReader();
    const cancel = () => {
      void reader?.cancel().catch(() => {});
    };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      signal.throwIfAborted();
      if (!response.ok) {
        const status = response.status;
        throw new JevError(
          status === 401 || status === 403
            ? "UNAUTHORIZED"
            : status === 404
              ? "MODEL_UNAVAILABLE"
              : status === 429
                ? "RATE_LIMITED"
                : "PROVIDER_UNAVAILABLE"
        );
      }
      const length = response.headers.get("content-length");
      if (length !== null && Number(length) > maxBytes)
        throw new JevError("RESPONSE_TOO_LARGE");
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader)
        for (;;) {
          const { value, done } = await reader.read();
          signal.throwIfAborted();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) throw new JevError("RESPONSE_TOO_LARGE");
          chunks.push(value);
        }
      return new Response(Buffer.concat(chunks), {
        status: response.status,
        headers: response.headers,
      });
    } finally {
      signal.removeEventListener("abort", cancel);
      cancel();
    }
  };
}
