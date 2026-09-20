import type { McpTool } from "../../../../shared/types/mcp.js";
export const hierarchyTools: McpTool[] = [
  {
    name: "get_lists",
    description: "Get lists in a folder",
    inputSchema: {
      type: "object",
      properties: {
        folder_id: {
          type: "string",
          description: "Folder ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        archived: {
          type: "boolean",
          description: "Include archived lists",
          default: false,
        },
      },
      required: ["folder_id"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_folderless_lists",
    description: "Get folderless lists in a space",
    inputSchema: {
      type: "object",
      properties: {
        space_id: {
          type: "string",
          description: "Space ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        archived: {
          type: "boolean",
          description: "Include archived lists",
          default: false,
        },
      },
      required: ["space_id"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "create_list",
    description: "Create a new list",
    inputSchema: {
      type: "object",
      properties: {
        folder_id: {
          type: "string",
          description: "Folder ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        name: {
          type: "string",
          description: "List name",
          minLength: 1,
          pattern: "\\S",
        },
        content: {
          type: "string",
          description: "List description",
        },
      },
      required: ["folder_id", "name"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "create_folderless_list",
    description: "Create a folderless list in a space",
    inputSchema: {
      type: "object",
      properties: {
        space_id: {
          type: "string",
          description: "Space ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        name: {
          type: "string",
          description: "List name",
          minLength: 1,
          pattern: "\\S",
        },
        content: {
          type: "string",
          description: "List description",
        },
      },
      required: ["space_id", "name"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "update_list",
    description: "Update a list",
    inputSchema: {
      type: "object",
      properties: {
        list_id: {
          type: "string",
          description: "List ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        name: {
          type: "string",
          description: "List name",
          minLength: 1,
          pattern: "\\S",
        },
        content: {
          type: "string",
          description: "List description",
        },
      },
      required: ["list_id"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "delete_list",
    description: "Delete a list",
    inputSchema: {
      type: "object",
      properties: {
        list_id: {
          type: "string",
          description: "List ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
      },
      required: ["list_id"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "get_folders",
    description: "Get folders in a space",
    inputSchema: {
      type: "object",
      properties: {
        space_id: {
          type: "string",
          description: "Space ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        archived: {
          type: "boolean",
          description: "Include archived folders",
          default: false,
        },
      },
      required: ["space_id"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "create_folder",
    description: "Create a new folder",
    inputSchema: {
      type: "object",
      properties: {
        space_id: {
          type: "string",
          description: "Space ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        name: {
          type: "string",
          description: "Folder name",
          minLength: 1,
          pattern: "\\S",
        },
      },
      required: ["space_id", "name"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "update_folder",
    description: "Update a folder",
    inputSchema: {
      type: "object",
      properties: {
        folder_id: {
          type: "string",
          description: "Folder ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        name: {
          type: "string",
          description: "Folder name",
          minLength: 1,
          pattern: "\\S",
        },
      },
      required: ["folder_id", "name"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "delete_folder",
    description: "Delete a folder",
    inputSchema: {
      type: "object",
      properties: {
        folder_id: {
          type: "string",
          description: "Folder ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
      },
      required: ["folder_id"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "get_spaces",
    description: "Get spaces in a team",
    inputSchema: {
      type: "object",
      properties: {
        team_id: {
          type: "string",
          description: "Team ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        archived: {
          type: "boolean",
          description: "Include archived spaces",
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
    name: "get_space",
    description: "Get a specific space",
    inputSchema: {
      type: "object",
      properties: {
        space_id: {
          type: "string",
          description: "Space ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
      },
      required: ["space_id"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "create_space",
    description: "Create a new space",
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
          description: "Space name",
          minLength: 1,
          pattern: "\\S",
        },
        multiple_assignees: {
          type: "boolean",
          description: "Allow multiple assignees",
          default: true,
        },
      },
      required: ["team_id", "name"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "update_space",
    description: "Update a space",
    inputSchema: {
      type: "object",
      properties: {
        space_id: {
          type: "string",
          description: "Space ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
        name: {
          type: "string",
          description: "Space name",
          minLength: 1,
          pattern: "\\S",
        },
        color: {
          type: "string",
          description: "Space color",
        },
        private: {
          type: "boolean",
          description: "Make space private",
        },
        multiple_assignees: {
          type: "boolean",
          description: "Allow multiple assignees",
        },
      },
      required: ["space_id"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "delete_space",
    description: "Delete a space",
    inputSchema: {
      type: "object",
      properties: {
        space_id: {
          type: "string",
          description: "Space ID",
          pattern: "^[A-Za-z0-9_-]+$",
          minLength: 1,
        },
      },
      required: ["space_id"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
];
