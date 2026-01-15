import { McpTool } from "../../../../shared/types/mcp.js";

export const githubTools: McpTool[] = [
  {
    name: "list_user_repositories",
    description: "List repositories for a specific GitHub user or organization",
    inputSchema: {
      type: "object",
      properties: {
        username: {
          type: "string",
          description: "GitHub username or organization name",
        },
        type: {
          type: "string",
          enum: ["all", "owner", "member"],
          description: "Type of repositories to list (default: owner)",
        },
        sort: {
          type: "string",
          enum: ["created", "updated", "pushed", "full_name"],
          description: "Sort repositories by (default: updated)",
        },
        direction: {
          type: "string",
          enum: ["asc", "desc"],
          description: "Sort direction (default: desc)",
        },
        per_page: {
          type: "number",
          minimum: 1,
          maximum: 100,
          description: "Number of repositories per page (default: 30)",
        },
        page: {
          type: "number",
          minimum: 1,
          description: "Page number (default: 1)",
        },
      },
      required: ["username"],
    },
  },
  {
    name: "get_repository",
    description: "Get detailed information about a specific repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: {
          type: "string",
          description: "Repository owner (username or organization)",
        },
        repo: {
          type: "string",
          description: "Repository name",
        },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "list_repository_contents",
    description: "List files and directories in a repository path",
    inputSchema: {
      type: "object",
      properties: {
        owner: {
          type: "string",
          description: "Repository owner",
        },
        repo: {
          type: "string",
          description: "Repository name",
        },
        path: {
          type: "string",
          description: "Path within the repository (default: root)",
        },
        ref: {
          type: "string",
          description: "Branch, tag, or commit SHA to view at",
        },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "get_file_content",
    description: "Get the content of a specific file in a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: {
          type: "string",
          description: "Repository owner",
        },
        repo: {
          type: "string",
          description: "Repository name",
        },
        path: {
          type: "string",
          description: "Path to the file",
        },
        ref: {
          type: "string",
          description: "Branch, tag, or commit SHA to view at",
        },
      },
      required: ["owner", "repo", "path"],
    },
  },
  {
    name: "search_repositories",
    description: "Search for repositories on GitHub using keywords",
    inputSchema: {
      type: "object",
      properties: {
        q: {
          type: "string",
          description: "Search query (supports GitHub search syntax)",
        },
        sort: {
          type: "string",
          enum: ["stars", "forks", "help-wanted-issues", "updated"],
          description: "Sort results by (default: best-match)",
        },
        order: {
          type: "string",
          enum: ["asc", "desc"],
          description: "Sort order (default: desc)",
        },
        per_page: {
          type: "number",
          minimum: 1,
          maximum: 100,
          description: "Number of results per page (default: 30)",
        },
        page: {
          type: "number",
          minimum: 1,
          description: "Page number (default: 1)",
        },
      },
      required: ["q"],
    },
  },
  {
    name: "get_repository_readme",
    description: "Get the README content of a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: {
          type: "string",
          description: "Repository owner",
        },
        repo: {
          type: "string",
          description: "Repository name",
        },
        ref: {
          type: "string",
          description: "Branch, tag, or commit SHA to view at",
        },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "list_branches",
    description: "List branches in a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: {
          type: "string",
          description: "Repository owner",
        },
        repo: {
          type: "string",
          description: "Repository name",
        },
        protected: {
          type: "boolean",
          description: "Only return protected branches",
        },
        per_page: {
          type: "number",
          minimum: 1,
          maximum: 100,
          description: "Number of branches per page (default: 30)",
        },
        page: {
          type: "number",
          minimum: 1,
          description: "Page number (default: 1)",
        },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "list_languages",
    description: "List programming languages used in a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: {
          type: "string",
          description: "Repository owner",
        },
        repo: {
          type: "string",
          description: "Repository name",
        },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "list_contributors",
    description: "List contributors to a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: {
          type: "string",
          description: "Repository owner",
        },
        repo: {
          type: "string",
          description: "Repository name",
        },
        anon: {
          type: "boolean",
          description: "Include anonymous contributors (default: false)",
        },
        per_page: {
          type: "number",
          minimum: 1,
          maximum: 100,
          description: "Number of contributors per page (default: 30)",
        },
        page: {
          type: "number",
          minimum: 1,
          description: "Page number (default: 1)",
        },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "get_repository_stats",
    description: "Get repository statistics (stars, forks, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        owner: {
          type: "string",
          description: "Repository owner",
        },
        repo: {
          type: "string",
          description: "Repository name",
        },
      },
      required: ["owner", "repo"],
    },
  },
];