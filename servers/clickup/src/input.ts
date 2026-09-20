import type { McpTool } from "../../../shared/types/mcp.js";
import { InputError } from "../../../shared/utils/errors.js";

export type Arguments = Record<string, unknown>;
interface Field {
  type?: string;
  properties?: Record<string, Field>;
  required?: string[];
  items?: Field;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  pattern?: string;
}
const object = (v: unknown): v is Arguments =>
  v !== null && typeof v === "object" && !Array.isArray(v);

// Only the schema keywords used by this server's fields. Cross-field rules follow.
function validate(value: unknown, schema: Field, key: string): void {
  if (schema.enum && !schema.enum.includes(value)) throw new InputError(key);
  switch (schema.type) {
    case "object":
      if (!object(value)) throw new InputError(key);
      for (const required of schema.required ?? [])
        if (value[required] === undefined) throw new InputError(required);
      for (const [field, child] of Object.entries(schema.properties ?? {}))
        if (value[field] !== undefined) validate(value[field], child, field);
      break;
    case "array":
      if (!Array.isArray(value)) throw new InputError(key);
      for (const item of value) validate(item, schema.items ?? {}, key);
      break;
    case "boolean":
      if (typeof value !== "boolean") throw new InputError(key);
      break;
    case "string":
      if (
        typeof value !== "string" ||
        value.length < (schema.minLength ?? 0) ||
        (schema.pattern && !new RegExp(schema.pattern).test(value))
      )
        throw new InputError(key);
      break;
    case "integer":
    case "number":
      if (
        typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        value < (schema.minimum ?? Number.MIN_SAFE_INTEGER) ||
        value > (schema.maximum ?? Number.MAX_SAFE_INTEGER)
      )
        throw new InputError(key);
      break;
  }
}
export function decimal(value: unknown, key: string): number {
  if (
    typeof value !== "string" ||
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(Number(value))
  )
    throw new InputError(key);
  return Number(value);
}

export function validateArguments(tool: McpTool, input: unknown): Arguments {
  validate(input, tool.inputSchema as Field, "arguments");
  const supplied = input as Arguments;
  const args = Object.fromEntries(
    Object.keys(tool.inputSchema.properties ?? {})
      .filter((key) => supplied[key] !== undefined)
      .map((key) => [key, supplied[key]])
  );
  // Preserve the public string timestamp/ID contract; encode numeric provider fields later.
  for (const key of ["due_date", "start_date", "end_date", "start"])
    if (
      args[key] !== undefined &&
      !(tool.name === "get_task_comments" && key === "start")
    )
      decimal(args[key], key);
  for (const key of ["assignee", "user_id"])
    if (args[key] !== undefined) decimal(args[key], key);
  if (args.owners !== undefined)
    for (const id of args.owners as string[]) decimal(id, "owners");
  if (Array.isArray(args.assignees))
    for (const id of args.assignees) decimal(id, "assignees");
  else if (object(args.assignees))
    for (const key of ["add", "rem"])
      if (args.assignees[key] !== undefined)
        for (const id of args.assignees[key] as string[])
          decimal(id, "assignees");
  if (tool.name === "get_tasks") {
    const selectors = ["list_id", "folder_id", "space_id"].filter(
      (k) => args[k] !== undefined
    );
    if (selectors.length !== 1) throw new InputError("list_id");
    if (!args.list_id && args.team_id === undefined)
      throw new InputError("team_id");
    if (!args.list_id && args.archived !== undefined)
      throw new InputError("archived");
  }
  if (
    tool.name === "get_task" &&
    args.custom_task_ids === true &&
    args.team_id === undefined
  )
    throw new InputError("team_id");
  if (
    tool.name === "get_task_comments" &&
    (args.start === undefined) !== (args.start_id === undefined)
  )
    throw new InputError("start_id");
  if (
    tool.name === "get_time_entries" &&
    args.start_date !== undefined &&
    args.end_date !== undefined &&
    Number(args.start_date) > Number(args.end_date)
  )
    throw new InputError("end_date");
  return args;
}
