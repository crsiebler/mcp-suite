import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerResponse } from "../types/common.js";
import { failure } from "./errors.js";

/** One wire envelope for migrated callers; no provider calls or retry behavior. */
export function toMcpResult(result: ServerResponse): CallToolResult {
  try {
    if (result.success && result.data === undefined)
      throw new Error("Missing data");
    const text = JSON.stringify(result);
    const envelope: unknown = JSON.parse(text);
    if (
      result.success &&
      (envelope === null ||
        typeof envelope !== "object" ||
        !("success" in envelope) ||
        envelope.success !== true ||
        !Object.prototype.hasOwnProperty.call(envelope, "data"))
    )
      throw new Error("Incomplete success envelope");
    return {
      isError: !result.success,
      content: [{ type: "text", text }],
    };
  } catch {
    return {
      isError: true,
      content: [
        { type: "text", text: JSON.stringify(failure("invalid_response")) },
      ],
    };
  }
}
