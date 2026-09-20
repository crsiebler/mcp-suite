# MCP Setup Guide

This guide shows how to set up the MCP servers from this suite with different AI coding assistants. Each platform has its own configuration format and requirements.

## Scope and current-source checks

This is a client setup guide, not repository development policy. All coding
harnesses share [AGENTS.md](../AGENTS.md); start with the
[repository map](overview.md) for engineering work. Claude Code examples below
remain client-specific examples and do not make it the required development tool.

Package names use this checkout's `@crsiebler` scope. These metadata changes do
not publish npm packages; registry examples require separately published packages. `npx` can download and execute packages. For this checkout, prefer
an explicitly authorized local build and verify its actual entry point using
[server development](server-development.md). Credential variables must reach the
server process; the shared helpers do not automatically load `.env` files.

## 🚀 Quick Start

The existing examples describe published-package and source-build workflows.
Check the selected package and version before using the published-package path.

### Option 1: Install a verified npm package

```bash
# Install globally to use anywhere
npm install -g @crsiebler/mcp-postgresql-server

# Or let npx fetch and execute the package (requires installation authorization)
npx @crsiebler/mcp-postgresql-server
```

### Option 2: Build from source

```bash
# Build the server
npm run build -- --server=postgresql

# PostgreSQL output with the current local build layout:
node ./servers/postgresql/dist/servers/postgresql/src/index.js
```

## Official Atlassian integration

The local Jira server has been removed. See [Rovo setup](atlassian-rovo.md) for
Cloud authentication and multiple-site configuration.

## 📋 Server Information

### Available Servers

| Server | npm Package | Binary Command | Environment Variables |
|--------|-------------|----------------|----------------------|
| Canvas | `@crsiebler/mcp-canvas-server` | `mcp-canvas` | `CANVAS_BASE_URL`, `CANVAS_API_TOKEN` |
| ClickUp | `@crsiebler/mcp-clickup-server` | `mcp-clickup` | `CLICKUP_API_TOKEN` |
| Elasticsearch | `@crsiebler/mcp-elasticsearch-server` | `mcp-elasticsearch` | `ELASTICSEARCH_URL`, `ELASTICSEARCH_USERNAME`, `ELASTICSEARCH_PASSWORD` |
| PostgreSQL | `@crsiebler/mcp-postgresql-server` | `mcp-postgresql` | `POSTGRESQL_CONNECTION_STRING` |
| Salesforce | `@crsiebler/mcp-salesforce-server` | `mcp-salesforce` | `SALESFORCE_LOGIN_URL`, `SALESFORCE_USERNAME`, `SALESFORCE_PASSWORD`, `SALESFORCE_SECURITY_TOKEN` |

### Environment Variables Setup

Create a `.env` file or set environment variables:

```bash
# PostgreSQL Server
POSTGRESQL_CONNECTION_STRING=postgresql://user:password@localhost:5432/database

# Canvas Server
CANVAS_BASE_URL=https://your-school.instructure.com
CANVAS_API_TOKEN=your-canvas-token
```

## 🔧 Platform-Specific Setup

### Using npm Packages (Recommended)

All configurations below can use either the local build path or the npm package with npx. Here are examples using the npm packages:

#### With npx (No Installation Required)

```bash
# Configure with npx commands
npx @crsiebler/mcp-postgresql-server
npx @crsiebler/mcp-canvas-server
```

#### With Global Installation

```bash
# Install first
npm install -g @crsiebler/mcp-postgresql-server

# Then use the binary directly
mcp-postgresql
```

### Continue.dev

Continue.dev supports MCP servers through both YAML and JSON configuration formats.

#### YAML Configuration (`.continue/config.yaml`)

```yaml
mcpServers:
  # Using npm packages with npx (recommended)
  - name: PostgreSQL Database
    command: npx
    args:
      - "@crsiebler/mcp-postgresql-server"
    env:
      POSTGRESQL_CONNECTION_STRING: "postgresql://user:password@localhost:5432/database"
  
  - name: Canvas LMS
    command: npx
    args:
      - "@crsiebler/mcp-canvas-server"
    env:
      CANVAS_BASE_URL: "https://your-school.instructure.com" 
      CANVAS_API_TOKEN: "your-canvas-token"

  # Alternative: Using local build (if building from source)
  # - name: PostgreSQL Database
  #   command: node
  #   args:
  #     - "/path/to/mcp-suite/dist/servers/postgresql/src/index.js"
  #   env:
  #     POSTGRESQL_CONNECTION_STRING: "postgresql://user:password@localhost:5432/database"
```

#### JSON Configuration (`.continue/config.json`)

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "name": "PostgreSQL Database",
        "transport": {
          "type": "stdio",
          "command": "npx",
          "args": ["@crsiebler/mcp-postgresql-server"]
        },
        "env": {
          "POSTGRESQL_CONNECTION_STRING": "postgresql://user:password@localhost:5432/database"
        }
      },
      {
        "name": "Canvas LMS",
        "transport": {
          "type": "stdio",
          "command": "npx",
          "args": ["@crsiebler/mcp-canvas-server"]
        },
        "env": {
          "CANVAS_BASE_URL": "https://your-school.instructure.com",
          "CANVAS_API_TOKEN": "your-canvas-token"
        }
      }
    ]
  }
}
```

### Claude Code

Claude Code offers multiple configuration methods with different scopes.

#### CLI Configuration (Recommended)

```bash
# Add PostgreSQL server using npm package
claude mcp add postgresql-db \
  -e POSTGRESQL_CONNECTION_STRING="postgresql://user:password@localhost:5432/database" \
  -- npx @crsiebler/mcp-postgresql-server

# Add Canvas server using npm package
claude mcp add canvas-lms \
  -e CANVAS_BASE_URL="https://your-school.instructure.com" \
  -e CANVAS_API_TOKEN="your-canvas-token" \
  -- npx @crsiebler/mcp-canvas-server

# Alternative: Using globally installed packages
# npm install -g @crsiebler/mcp-postgresql-server
# claude mcp add postgresql-db -e ... -- mcp-postgresql
```

#### Project-Scoped Configuration (`.mcp.json`)

For team-shared configuration:

```json
{
  "mcpServers": {
    "postgresql-db": {
      "command": "npx",
      "args": ["@crsiebler/mcp-postgresql-server"],
      "env": {
        "POSTGRESQL_CONNECTION_STRING": "postgresql://user:password@localhost:5432/database"
      }
    },
    "canvas-lms": {
      "command": "npx",
      "args": ["@crsiebler/mcp-canvas-server"],
      "env": {
        "CANVAS_BASE_URL": "https://your-school.instructure.com",
        "CANVAS_API_TOKEN": "your-canvas-token"
      }
    }
  }
}
```

#### Management Commands

```bash
# List all configured servers
claude mcp list

# Get details for specific server
claude mcp get postgresql-db

# Remove a server
claude mcp remove postgresql-db

# Reset project approvals
claude mcp reset-project-choices
```

### Cline (VS Code Extension)

Cline uses JSON configuration files stored in VS Code's global storage.

#### Configuration File Location

- **macOS**: `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- **Windows**: `%APPDATA%/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- **Linux**: `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

#### Configuration Format

```json
{
  "mcpServers": {
    "postgresql-db": {
      "command": "npx",
      "args": ["@crsiebler/mcp-postgresql-server"],
      "env": {
        "POSTGRESQL_CONNECTION_STRING": "postgresql://user:password@localhost:5432/database"
      },
      "disabled": false,
      "alwaysAllow": ["execute_query", "list_tables"]
    },
    "canvas-lms": {
      "command": "npx",
      "args": ["@crsiebler/mcp-canvas-server"],
      "env": {
        "CANVAS_BASE_URL": "https://your-school.instructure.com",
        "CANVAS_API_TOKEN": "your-canvas-token"
      },
      "disabled": false,
      "alwaysAllow": ["list_courses", "get_course", "list_assignments"]
    }
  }
}
```

#### Configuration Parameters

- **command**: Executable command to run the server
- **args**: Array of command-line arguments
- **env**: Environment variables for the server
- **disabled**: Boolean to enable/disable the server
- **alwaysAllow**: Array of tools that don't require approval
- **autoApprove**: Alternative to alwaysAllow

#### Management Through UI

Access server settings through the Cline extension:
1. Click the "MCP Servers" icon in the top navigation
2. Configure individual servers through their panels
3. Set network timeouts using the dropdown in each server's config box

## 🐛 Troubleshooting

### Common Issues

1. **Server not starting**: Check that the built files exist in `dist/servers/{server-name}/src/index.js`
2. **Environment variables not loaded**: Ensure variables are set in your shell or configuration file
3. **Permission issues**: Make sure the server files have execute permissions

### Debug Mode

Enable debug mode for troubleshooting:

```bash
# Claude Code
claude --mcp-debug

# Continue.dev - check logs in the extension
# Cline - check VS Code developer console
```

### Verification

Test your server setup:

```bash
# Test server directly with npx
npx @crsiebler/mcp-postgresql-server

# Test with environment variables
POSTGRESQL_CONNECTION_STRING="postgresql://user:pass@localhost:5432/db" npx @crsiebler/mcp-postgresql-server

# Check environment variables
echo $POSTGRESQL_CONNECTION_STRING

# Test global installation
npm install -g @crsiebler/mcp-postgresql-server
mcp-postgresql
```

## 📚 Additional Resources

- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [Continue.dev MCP Guide](https://docs.continue.dev/customize/deep-dives/mcp)
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Cline MCP Documentation](https://docs.cline.bot/mcp/configuring-mcp-servers)

## 🔐 Security Notes

- Store API tokens and connection strings securely
- Use environment variables instead of hardcoding credentials
- Review tool permissions before allowing automatic approval
- Consider using project-scoped configurations for team environments