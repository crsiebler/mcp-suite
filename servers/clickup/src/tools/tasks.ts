import type { McpTool } from "../../../../shared/types/mcp.js";
export const tasksTools: McpTool[] = [
  {
    name: "get_tasks",
    description:
      "Get one page of tasks from exactly one List, Folder or Space. Folder/Space requires team_id; archived is List-only.",
    inputSchema: {
      type: "object",
      properties: {
        list_id: {
          type: "string",
          description: "List ID to get tasks from",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        folder_id: {
          type: "string",
          description: "Folder ID to get tasks from",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        space_id: {
          type: "string",
          description: "Space ID to get tasks from",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        archived: {
          type: "boolean",
          description: "Include archived tasks",
          default: false,
        },
        page: {
          type: "integer",
          description: "Page number for pagination",
          default: 0,
          maximum: 9007199254740991,
          minimum: 0,
        },
        order_by: {
          type: "string",
          description: "Order tasks by field",
          enum: ["id", "created", "updated", "due_date"],
          default: "created",
        },
        reverse: {
          type: "boolean",
          description: "Reverse the order",
          default: false,
        },
        subtasks: {
          type: "boolean",
          description: "Include subtasks",
          default: false,
        },
        statuses: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Filter by status names",
        },
        include_closed: {
          type: "boolean",
          description: "Include closed tasks",
          default: false,
        },
        assignees: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Filter by assignee user IDs",
        },
        team_id: {
          type: "string",
          description: "Workspace ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
      },
      oneOf: [
        {
          required: ["list_id"],
        },
        {
          required: ["folder_id"],
        },
        {
          required: ["space_id"],
        },
      ],
      allOf: [
        {
          if: {
            required: ["folder_id"],
          },
          then: {
            required: ["team_id"],
            not: {
              required: ["archived"],
            },
          },
        },
        {
          if: {
            required: ["space_id"],
          },
          then: {
            required: ["team_id"],
            not: {
              required: ["archived"],
            },
          },
        },
      ],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_task",
    description: "Get a specific task by ID",
    inputSchema: {
      type: "object",
      properties: {
        task_id: {
          type: "string",
          description: "Task ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        custom_task_ids: {
          type: "boolean",
          description: "Use custom task IDs",
          default: false,
        },
        team_id: {
          type: "string",
          description: "Team ID (required when using custom task IDs)",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        include_subtasks: {
          type: "boolean",
          description: "Include subtasks",
          default: false,
        },
      },
      required: ["task_id"],
      allOf: [
        {
          if: {
            properties: {
              custom_task_ids: {
                const: true,
              },
            },
            required: ["custom_task_ids"],
          },
          then: {
            required: ["team_id"],
          },
        },
      ],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "create_task",
    description: "Create a new task",
    inputSchema: {
      type: "object",
      properties: {
        list_id: {
          type: "string",
          description: "List ID where the task will be created",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        name: {
          type: "string",
          description: "Task name",
          minLength: 1,
          pattern: "\\S",
        },
        description: {
          type: "string",
          description: "Task description",
        },
        assignees: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Array of assignee user IDs",
        },
        tags: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Array of tag names",
        },
        status: {
          type: "string",
          description: "Task status",
        },
        priority: {
          type: "integer",
          description: "Priority (1=urgent, 2=high, 3=normal, 4=low)",
          enum: [1, 2, 3, 4],
          maximum: 9007199254740991,
          minimum: 0,
        },
        due_date: {
          type: "string",
          description:
            "Due date (Unix timestamp in milliseconds); decimal safe integer string",
          pattern: "^\\d+$",
        },
        due_date_time: {
          type: "boolean",
          description: "Include time in due date",
          default: false,
        },
        time_estimate: {
          type: "integer",
          description: "Time estimate in milliseconds",
          maximum: 9007199254740991,
          minimum: 0,
        },
        start_date: {
          type: "string",
          description:
            "Start date (Unix timestamp in milliseconds); decimal safe integer string",
          pattern: "^\\d+$",
        },
        start_date_time: {
          type: "boolean",
          description: "Include time in start date",
          default: false,
        },
        notify_all: {
          type: "boolean",
          description: "Notify all assignees",
          default: true,
        },
        parent: {
          type: "string",
          description: "Parent task ID (for subtasks)",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
      },
      required: ["list_id", "name"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "update_task",
    description: "Update an existing task",
    inputSchema: {
      type: "object",
      properties: {
        task_id: {
          type: "string",
          description: "Task ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        name: {
          type: "string",
          description: "Task name",
          minLength: 1,
          pattern: "\\S",
        },
        description: {
          type: "string",
          description: "Task description",
        },
        status: {
          type: "string",
          description: "Task status",
        },
        priority: {
          type: "integer",
          description: "Priority (1=urgent, 2=high, 3=normal, 4=low)",
          enum: [1, 2, 3, 4],
          maximum: 9007199254740991,
          minimum: 0,
        },
        due_date: {
          type: "string",
          description:
            "Due date (Unix timestamp in milliseconds); decimal safe integer string",
          pattern: "^\\d+$",
        },
        due_date_time: {
          type: "boolean",
          description: "Include time in due date",
          default: false,
        },
        assignees: {
          type: "object",
          properties: {
            add: {
              type: "array",
              items: {
                type: "string",
              },
              description: "User IDs to add as assignees",
            },
            rem: {
              type: "array",
              items: {
                type: "string",
              },
              description: "User IDs to remove as assignees",
            },
          },
        },
        archived: {
          type: "boolean",
          description: "Archive the task",
        },
      },
      required: ["task_id"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "delete_task",
    description: "Delete a task",
    inputSchema: {
      type: "object",
      properties: {
        task_id: {
          type: "string",
          description: "Task ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
      },
      required: ["task_id"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "get_task_comments",
    description:
      "Get one page of comments (25 newest by default). For older comments provide start and start_id from the last returned comment.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: {
          type: "string",
          description: "Task ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        start: {
          type: "integer",
          minimum: 0,
          maximum: 9007199254740991,
          description: "Timestamp of the last comment on the previous page",
        },
        start_id: {
          type: "string",
          description: "ID of the last comment on the previous page",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
      },
      required: ["task_id"],
      dependencies: {
        start: ["start_id"],
        start_id: ["start"],
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "create_task_comment",
    description: "Create a comment on a task",
    inputSchema: {
      type: "object",
      properties: {
        task_id: {
          type: "string",
          description: "Task ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        comment_text: {
          type: "string",
          description: "Comment text",
          minLength: 1,
          pattern: "\\S",
        },
        notify_all: {
          type: "boolean",
          description: "Notify all task assignees",
          default: true,
        },
      },
      required: ["task_id", "comment_text"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
];
