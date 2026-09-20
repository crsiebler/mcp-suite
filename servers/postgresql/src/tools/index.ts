import { McpTool } from "../../../../shared/types/mcp.js";

export const postgresqlTools: McpTool[] = [
  {
    name: "execute_query",
    description:
      "Execute one SQL statement unchanged with optional string parameters. Read-only checks apply unless dangerous operations are enabled. Returned rows are capped (default 100), with truncated and returnedRowCount metadata; use explicit SQL LIMIT to reduce database work. Execution has a deadline; verify uncertain outcomes before retrying.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "SQL query to execute",
        },
        params: {
          type: "array",
          description: "Query parameters for prepared statements",
          items: {
            type: "string",
          },
        },
      },
      required: ["query"],
    },
  },
  {
    name: "check_dangerous_operations_allowed",
    description:
      "Check if dangerous operations (INSERT, UPDATE, DELETE, etc.) are allowed on this PostgreSQL server. This helps LLMs understand what operations they can perform.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];
