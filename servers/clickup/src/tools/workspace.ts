import type { McpTool } from "../../../../shared/types/mcp.js";
export const workspaceTools: McpTool[] = [
  {
    name: "get_teams",
    description: "Get authorized teams for the user",
    inputSchema: {
      type: "object",
      properties: {},
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_team_members",
    description:
      "Get member entries for one Workspace from Get Authorized Workspaces.",
    inputSchema: {
      type: "object",
      properties: {
        team_id: {
          type: "string",
          description: "Team ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
      },
      required: ["team_id"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_user",
    description: "Get a user in a Workspace (requires ClickUp Enterprise).",
    inputSchema: {
      type: "object",
      properties: {
        user_id: {
          type: "string",
          description: "User ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        team_id: {
          type: "string",
          description: "Workspace ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
      },
      required: ["user_id", "team_id"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_time_entries",
    description: "Get time entries for a team",
    inputSchema: {
      type: "object",
      properties: {
        team_id: {
          type: "string",
          description: "Team ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        start_date: {
          type: "string",
          description:
            "Start date (Unix timestamp in milliseconds); decimal safe integer string",
          pattern: "^\\d+$",
        },
        end_date: {
          type: "string",
          description:
            "End date (Unix timestamp in milliseconds); decimal safe integer string",
          pattern: "^\\d+$",
        },
        assignee: {
          type: "string",
          description: "Filter by assignee user ID",
        },
      },
      required: ["team_id"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "create_time_entry",
    description: "Create a time entry",
    inputSchema: {
      type: "object",
      properties: {
        team_id: {
          type: "string",
          description: "Team ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        description: {
          type: "string",
          description: "Time entry description",
        },
        start: {
          type: "string",
          description:
            "Start time (Unix timestamp in milliseconds); decimal safe integer string",
          pattern: "^\\d+$",
        },
        duration: {
          type: "integer",
          description: "Duration in milliseconds",
          maximum: 9007199254740991,
        },
        assignee: {
          type: "string",
          description: "Assignee user ID",
        },
        tid: {
          type: "string",
          description: "Task ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
      },
      required: ["team_id", "start", "duration"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "get_goals",
    description: "Get goals for a team",
    inputSchema: {
      type: "object",
      properties: {
        team_id: {
          type: "string",
          description: "Team ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        include_completed: {
          type: "boolean",
          description: "Include completed goals",
          default: false,
        },
      },
      required: ["team_id"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "create_goal",
    description: "Create a new goal",
    inputSchema: {
      type: "object",
      properties: {
        team_id: {
          type: "string",
          description: "Team ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        name: {
          type: "string",
          description: "Goal name",
          minLength: 1,
          pattern: "\\S",
        },
        due_date: {
          type: "string",
          description:
            "Due date (Unix timestamp in milliseconds); decimal safe integer string",
          pattern: "^\\d+$",
        },
        description: {
          type: "string",
          description: "Goal description",
        },
        owners: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Array of owner user IDs",
        },
        color: {
          type: "string",
          description: "Goal color",
        },
        multiple_owners: {
          type: "boolean",
          description: "Allow multiple goal owners",
        },
      },
      required: [
        "team_id",
        "name",
        "due_date",
        "description",
        "multiple_owners",
        "owners",
        "color",
      ],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
];
