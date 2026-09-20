# ClickUp Server

A comprehensive MCP server for ClickUp integration, providing task management, project organization, time tracking, and team collaboration features.

## Installation & Usage

### Option 1: npm Package (Recommended)

```bash
# Install globally
npm install -g @crsiebler/mcp-clickup-server

# Or run directly with npx
npx @crsiebler/mcp-clickup-server
```

### Option 2: Build from Source

```bash
# From project root
npm ci
npm run build -- --server=clickup

# The server will be available at:
./servers/clickup/dist/servers/clickup/src/index.js
```

## Cline MCP Configuration

To use this server with Cline (VS Code extension), add the following to your Cline MCP settings:

**File Location:**

- **macOS**: `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- **Windows**: `%APPDATA%/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- **Linux**: `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

**Configuration:**

```json
{
  "mcpServers": {
    "clickup-integration": {
      "command": "npx",
      "args": ["@crsiebler/mcp-clickup-server"],
      "env": {
        "CLICKUP_API_TOKEN": "your-api-token"
      },
      "disabled": false,
      "alwaysAllow": []
    }
  }
}
```

## Features

- **Task Management**: Create, read, update, and delete tasks with the advertised fields
- **Project Organization**: Manage spaces, folders, and lists with hierarchical organization
- **Comments**: Add and retrieve task comments with notification options
- **Team Collaboration**: Access team members and user information
- **Time Tracking**: Create and retrieve time entries for productivity tracking
- **Goals**: Create and manage team goals with progress tracking

## Installation

```bash
npm install @crsiebler/mcp-clickup-server
```

## Configuration

Set your ClickUp API token as an environment variable:

```bash
export CLICKUP_API_TOKEN="your_clickup_api_token_here"
```

To get your ClickUp API token:

1. Go to your ClickUp settings
2. Navigate to "Apps" section
3. Generate a new API token
4. Copy the token and set it as the environment variable

## Usage

### With Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "clickup": {
      "command": "npx",
      "args": ["@crsiebler/mcp-clickup-server"],
      "env": {
        "CLICKUP_API_TOKEN": "your_clickup_api_token_here"
      }
    }
  }
}
```

### With Other MCP Clients

Run the server:

```bash
npx @crsiebler/mcp-clickup-server
```

## Available Tools

### Task Operations (5 tools)

- `get_tasks` - Get tasks from a list, folder, or space with filtering options
- `get_task` - Get detailed information about a specific task
- `create_task` - Create a new task with the advertised fields
- `update_task` - Update existing task properties and assignments
- `delete_task` - Delete a task permanently

### Comment Operations (2 tools)

- `get_task_comments` - Retrieve one page of comments for a specific task
- `create_task_comment` - Add a comment to a task with notification options

### List Operations (6 tools)

- `get_lists` - Get lists within a folder
- `get_folderless_lists` - Get lists directly in a space (no folder)
- `create_list` - Create a new list in a folder
- `create_folderless_list` - Create a new list directly in a space
- `update_list` - Update list properties
- `delete_list` - Delete a list permanently

### Folder Operations (4 tools)

- `get_folders` - Get folders within a space
- `create_folder` - Create a new folder in a space
- `update_folder` - Update folder properties
- `delete_folder` - Delete a folder permanently

### Space Operations (5 tools)

- `get_spaces` - Get spaces within a team
- `get_space` - Get detailed information about a specific space
- `create_space` - Create a new space in a team
- `update_space` - Update space properties and settings
- `delete_space` - Delete a space permanently

### Team & User Operations (3 tools)

- `get_teams` - Get all authorized teams for the user
- `get_team_members` - Get members of a specific team
- `get_user` - Get detailed user information

### Time Tracking Operations (2 tools)

- `get_time_entries` - Get time entries for a team with filtering
- `create_time_entry` - Create a new time entry for productivity tracking

### Goal Operations (2 tools)

- `get_goals` - Get goals for a team with completion filtering
- `create_goal` - Create a new team goal with owners and deadlines

## Tool Examples

### Creating a Task

```json
{
  "name": "create_task",
  "arguments": {
    "list_id": "123456789",
    "name": "Implement new feature",
    "description": "Add user authentication to the application",
    "priority": 2,
    "assignees": ["987654321"],
    "tags": ["feature", "authentication"],
    "due_date": "1640995200000"
  }
}
```

### Getting Tasks with Filters

```json
{
  "name": "get_tasks",
  "arguments": {
    "list_id": "123456789",
    "statuses": ["in progress", "review"],
    "assignees": ["987654321"],
    "order_by": "due_date",
    "include_closed": false
  }
}
```

### Creating a Time Entry

```json
{
  "name": "create_time_entry",
  "arguments": {
    "team_id": "456789123",
    "description": "Working on authentication feature",
    "start": "1640995200000",
    "duration": 7200000,
    "tid": "task_id_here"
  }
}
```

## Priority Levels

When creating or updating tasks, use these priority values:

- `1` - Urgent (red)
- `2` - High (yellow)
- `3` - Normal (blue)
- `4` - Low (gray)

## Date Formats

All dates should be provided as Unix timestamps in milliseconds. For example:

- `"1640995200000"` represents January 1, 2022, 00:00:00 UTC

## Contracts and migration

Tool names remain unchanged. Discovery includes read/write/destructive hints;
annotations do not grant permissions or replace host approval for mutations.
The existing token header and ClickUp base URL remain unchanged.

- `get_tasks`: provide exactly one of `list_id`, `folder_id`, or `space_id`.
  Folder/Space queries now require `team_id` and use the documented Workspace
  task endpoint with `project_ids[]`/`space_ids[]` filters. The previous
  `/folder/{id}/task` and `/space/{id}/task` routes were unsupported. `archived`
  is accepted only for List queries; it is not silently ignored for Workspace
  queries. Each call fetches one page (up to 100 tasks); `page` starts at zero.
  Returned provider fields, including `last_page` when present, remain intact.
- `get_task_comments`: each call returns one page (25 newest by default), not
  the entire history. Pass both `start` (numeric timestamp) and `start_id`
  (string) from the last returned comment to retrieve older comments. Neither
  tasks nor comments automatically traverse pages.
- `get_user`: now requires both `team_id` and `user_id` and uses
  `/team/{team_id}/user/{user_id}`. This provider endpoint requires Enterprise.
- `get_team_members`: selects the requested Workspace from `/team` and returns
  `{ "members": [...] }`, retaining provider member entries. An inaccessible
  Workspace returns `not_found`; malformed member inventory returns
  `invalid_response`. It no longer requests the unsupported `/team/{id}/member`.
- `create_goal`: now requires `team_id`, `name`, `due_date`, `description`,
  `multiple_owners`, `owners`, and `color`, matching the documented request.
  Supply these fields explicitly instead of relying on undocumented defaults.
- Timestamp inputs remain decimal strings except the new numeric comment cursor.
  User IDs remain strings in MCP arguments. Fields documented as provider
  integers are converted in request bodies (dates, time-entry assignee,
  task assignees, goal owners), rejecting unsafe or nonnumeric values.
  Update-task assignee `add`/`rem` arrays default individually to empty arrays.
  False, zero, empty editable text and empty arrays are preserved. The provider
  determines which clearing/zero-duration operations it accepts.
- Required values, field types, enum values, integer pagination and cursor pairs
  are checked before I/O. Path identifiers accept letters, digits, `_` and `-`;
  separators/query delimiters are rejected. Undocumented extra arguments remain
  ignored by request mapping. The schema describes this server's supported
  fields, not the entire provider API.

Successful results retain raw provider JSON (apart from member projection);
missing response data becomes JSON null. Errors now return MCP `isError: true`
with `{ "success": false, "error": { "code", "message" } }` instead of raw
`ClickUp API Error: ...` text. Categories distinguish invalid input, credentials,
permissions, missing resources, rate limits, timeouts and unavailable providers.
Valid Retry-After metadata is returned as `retryAfterSeconds`. Provider error
messages and private payloads are omitted. Requests are not automatically retried;
check mutation outcomes before retrying after a timeout.

Offline fixtures verify all 29 routes plus pagination, request bodies, input
rejection and errors. They do not establish live permissions, Enterprise access,
provider limits or full response-schema validity. Task page counts do not bound
response bytes or the size of other inventories. Authentication is unchanged.

Official contracts checked for these changes:
[Tasks](https://developer.clickup.com/reference/gettasks),
[Workspace task filtering](https://developer.clickup.com/reference/getfilteredteamtasks),
[comment pagination](https://developer.clickup.com/reference/gettaskcomments),
[Workspace members](https://developer.clickup.com/reference/getauthorizedteams),
[user lookup](https://developer.clickup.com/reference/getuser),
[task creation](https://developer.clickup.com/reference/createtask),
[task updates](https://developer.clickup.com/reference/updatetask),
[time entries](https://developer.clickup.com/reference/createatimeentry), and
[goal creation](https://developer.clickup.com/reference/creategoal).

## Development

### Building

```bash
npm run build
```

### Testing

Run offline checks from the repository root; no token or live writes are needed:

```bash
npm test -- tests/unit/clickup-contracts.test.ts tests/unit/clickup-boundaries.test.ts
npm run type-check
```

## API Reference

This server exposes 29 selected ClickUp REST API v2 operations. For detailed parameter descriptions and response formats, refer to the [ClickUp API Documentation](https://clickup.com/api/).

## License

Existing metadata declares MIT; see [license provenance](../../docs/licensing.md).
