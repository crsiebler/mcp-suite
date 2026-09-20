const messages = {
  INVALID_INPUT: "Invalid evaluation input.",
  UNAUTHORIZED: "Gateway access denied.",
  MODEL_UNAVAILABLE: "Evaluation model unavailable.",
  RATE_LIMITED: "Gateway rate limit reached.",
  PROVIDER_UNAVAILABLE: "Gateway request failed.",
  INVALID_RESPONSE: "Invalid evaluation response.",
  RESPONSE_TOO_LARGE: "Evaluation response exceeds the limit.",
  PROVIDER_WARNING: "Provider reported an unsupported or uncertain setting.",
  TIMEOUT: "Evaluation deadline exceeded.",
  CANCELLED: "Evaluation cancelled.",
  OVERLOADED: "Two evaluations are already running.",
  SHUTDOWN: "Server is shutting down.",
  INTERNAL_ERROR: "Evaluation failed.",
} as const;
export type ErrorCode = keyof typeof messages;
export class JevError extends Error {
  constructor(readonly code: ErrorCode) {
    super(messages[code]);
  }
}
export function errorResult(error: unknown) {
  const safe =
    error instanceof JevError ? error : new JevError("INTERNAL_ERROR");
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          error: { code: safe.code, message: safe.message },
        }),
      },
    ],
  };
}
