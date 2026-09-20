// Defense in depth: callers must still use static messages and minimal metadata.
// Arbitrary private prose cannot be reliably recognized as a secret.
const REDACTED = "[REDACTED]";
const sensitiveKey =
  /token|password|passwd|secret|authorization|credential|cookie|apikey|connection|databaseurl|privatekey|username|^dsn$/i;
const payloadKey =
  /^(body|data|request|response|config|headers|query|sql|params|arguments|stack|message)$/i;

export function safeText(value: string): string {
  return value
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s<>"']+/gi, "[URL REDACTED]")
    .replace(/\b(Bearer|Basic)\s+[^\s,;]+/gi, "$1 [REDACTED]")
    .replace(
      /\b([\w-]*(?:token|password|passwd|secret|api[_-]?key|authorization|credential)[\w-]*)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1=[REDACTED]"
    )
    .replace(/[\s\S]/g, (character) => {
      const code = character.charCodeAt(0);
      return code < 32 ||
        (code >= 127 && code <= 159) ||
        code === 8232 ||
        code === 8233
        ? " "
        : character;
    })
    .slice(0, 1024);
}

/** Never call custom getters/toJSON. Bound traversal as well as emitted size. */
export function safeLogData(value: unknown): unknown {
  const seen = new WeakSet<object>();
  let remaining = 100;
  function visit(item: unknown, depth: number): unknown {
    if (--remaining < 0 || depth > 5) return "[Truncated]";
    if (typeof item === "string") return safeText(item);
    if (typeof item === "bigint") return String(item);
    if (item === null || typeof item === "boolean" || typeof item === "number")
      return item;
    if (typeof item !== "object") return `[${typeof item}]`;
    if (seen.has(item)) return "[Circular]";
    seen.add(item);
    try {
      if (item instanceof Error) {
        return safeLogError(item);
      }
      const result: Record<string, unknown> = Object.create(null);
      const keys = Object.keys(item);
      for (const key of keys.slice(0, 20)) {
        const normalized = key.replace(/[^a-z0-9]/gi, "");
        const label = safeText(key);
        if (sensitiveKey.test(normalized) || payloadKey.test(normalized)) {
          result[label] = REDACTED;
          continue;
        }
        const property = Object.getOwnPropertyDescriptor(item, key);
        result[label] =
          property && "value" in property
            ? visit(property.value, depth + 1)
            : "[Accessor omitted]";
      }
      if (keys.length > 20) result.truncated = true;
      return result;
    } catch {
      return "[Unserializable]";
    }
  }
  return visit(value, 0);
}

/** Rejections may be any value; preserve only bounded machine metadata. */
export function safeLogError(error: unknown): Record<string, unknown> {
  const summary: Record<string, unknown> = { type: "Error" };
  if (error === null || typeof error !== "object") return summary;
  try {
    const code = Object.getOwnPropertyDescriptor(error, "code");
    if (
      code &&
      "value" in code &&
      typeof code.value === "string" &&
      /^[A-Z0-9_]{1,40}$/.test(code.value)
    ) {
      summary.code = code.value;
    }
    const status = Object.getOwnPropertyDescriptor(error, "status");
    if (
      status &&
      "value" in status &&
      Number.isInteger(status.value) &&
      status.value >= 100 &&
      status.value <= 599
    ) {
      summary.status = status.value;
    }
  } catch {
    // Proxies need not allow descriptor access. Never include thrown text.
  }
  return summary;
}
