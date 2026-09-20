import type { McpTool } from "../../../shared/types/mcp.js";
import { InputError } from "../../../shared/utils/errors.js";
import type {
  BulkOperation,
  CreateIndexOptions,
  SearchOptions,
} from "./types/index.js";

export interface ElasticArguments extends SearchOptions, CreateIndexOptions {
  id: string;
  document: Record<string, unknown>;
  refresh?: boolean;
  operations: BulkOperation["operations"];
  source_index: string;
  dest_index: string;
}
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0;

/** Validate the server's advertised fields, not the provider's query DSL. */
export function validateArguments(
  tool: McpTool,
  input: unknown
): ElasticArguments {
  if (!object(input)) throw new InputError("arguments");
  const required = tool.inputSchema.required;
  for (const key of Array.isArray(required) ? required : []) {
    if (input[key] === undefined) throw new InputError(key);
  }
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    switch (key) {
      case "index":
      case "id":
      case "source_index":
      case "dest_index":
        if (!text(value)) throw new InputError(key);
        break;
      case "query":
      case "document":
      case "aggs":
      case "mappings":
      case "settings":
      case "highlight":
        if (!object(value)) throw new InputError(key);
        break;
      case "size":
      case "from": {
        const max =
          key === "from"
            ? Number.MAX_SAFE_INTEGER
            : tool.name === "elasticsearch_aggregation"
              ? 100
              : 1000;
        if (
          typeof value !== "number" ||
          !Number.isSafeInteger(value) ||
          value < 0 ||
          value > max
        )
          throw new InputError(key);
        break;
      }
      case "refresh":
      case "track_total_hits":
        if (typeof value !== "boolean") throw new InputError(key);
        break;
      case "sort":
        if (
          !Array.isArray(value) ||
          !value.every((item) => text(item) || object(item))
        )
          throw new InputError(key);
        break;
      case "_source":
        if (
          typeof value !== "boolean" &&
          !(Array.isArray(value) && value.every(text))
        )
          throw new InputError(key);
        break;
      case "operations":
        if (!Array.isArray(value) || value.length < 1 || value.length > 100)
          throw new InputError(key);
        for (const op of value) {
          if (
            !object(op) ||
            typeof op.action !== "string" ||
            !["index", "create", "update", "delete"].includes(op.action)
          )
            throw new InputError("operations.action");
          if (
            (op.action === "update" ||
              op.action === "delete" ||
              op.id !== undefined) &&
            !text(op.id)
          )
            throw new InputError("operations.id");
          if (op.action !== "delete" && !object(op.document))
            throw new InputError("operations.document");
          if (op.document !== undefined && !object(op.document))
            throw new InputError("operations.document");
        }
        break;
    }
  }
  return input as unknown as ElasticArguments;
}
