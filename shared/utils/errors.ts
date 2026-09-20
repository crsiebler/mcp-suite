import type { FailureCode, ServerFailure } from "../types/common.js";

const messages: Record<FailureCode, string> = {
  invalid_input: "Invalid tool input. Check the required fields.",
  authentication:
    "Provider credentials were rejected. Check the configured credentials.",
  forbidden: "Provider denied access. Check account permissions.",
  not_found: "Provider resource was not found. Check the requested identifier.",
  rate_limited: "Provider rate limit reached. Wait before retrying.",
  timeout:
    "Provider request timed out; the outcome may be unknown. Check before retrying.",
  unavailable: "Provider is unavailable. Check its status before retrying.",
  provider_error:
    "Provider rejected the request. Check the operation and inputs.",
  invalid_response:
    "Provider returned an invalid response. Check the integration contract.",
  internal_error: "Tool execution failed. Check server diagnostics.",
};

export class InputError extends Error {
  constructor(readonly field: string) {
    super(`Invalid input field ${field}`);
  }
}

export function failure(code: FailureCode): ServerFailure {
  return { success: false, error: { code, message: messages[code] } };
}

function property(value: unknown, key: string): unknown {
  if (value === null || typeof value !== "object") return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

function retryHeader(headers: unknown): unknown {
  if (headers === null || typeof headers !== "object") return undefined;
  const key = Object.keys(headers).find(
    (name) => name.toLowerCase() === "retry-after"
  );
  return key === undefined ? undefined : property(headers, key);
}

function retryAfter(value: unknown, now: number): number | undefined {
  if (typeof value !== "string" || value.length > 80) return undefined;
  let seconds: number;
  if (/^\d+$/.test(value)) {
    seconds = Number(value);
  } else {
    const date = Date.parse(value);
    if (!Number.isFinite(date) || new Date(date).toUTCString() !== value)
      return undefined;
    seconds = Math.max(0, Math.ceil((date - now) / 1000));
  }
  return Number.isSafeInteger(seconds) && seconds >= 0 && seconds <= 2147483647
    ? seconds
    : undefined;
}

/** Classify metadata only; never copy provider messages, bodies or credentials. */
export function normalizeFailure(
  error: unknown,
  now = Date.now()
): ServerFailure {
  try {
    if (error instanceof InputError) {
      const result = failure("invalid_input");
      const field = property(error, "field");
      if (
        typeof field === "string" &&
        /^[a-zA-Z][a-zA-Z0-9_.]{0,63}$/.test(field)
      ) {
        result.error.message = `Invalid input field ${field}. Check its required type and value.`;
      }
      return result;
    }
    const response = property(error, "response");
    const status = property(response, "status") ?? property(error, "status");
    const code = property(error, "code");
    let category: FailureCode = "internal_error";
    if (code === "ETIMEDOUT" || code === "ECONNABORTED") category = "timeout";
    else if (status === 401) category = "authentication";
    else if (status === 403) category = "forbidden";
    else if (status === 404) category = "not_found";
    else if (status === 429) category = "rate_limited";
    else if (typeof status === "number" && status >= 500 && status <= 599)
      category = "unavailable";
    else if (typeof status === "number" && status >= 400 && status <= 499)
      category = "provider_error";
    else if (
      [
        "ECONNREFUSED",
        "ECONNRESET",
        "ENOTFOUND",
        "EAI_AGAIN",
        "ERR_NETWORK",
      ].includes(typeof code === "string" ? code : "")
    )
      category = "unavailable";
    const result = failure(category);
    if (category === "rate_limited" || category === "unavailable") {
      const headers = property(response, "headers");
      const delay = retryAfter(retryHeader(headers), now);
      if (delay !== undefined) result.error.retryAfterSeconds = delay;
    }
    return result;
  } catch {
    return failure("internal_error");
  }
}
