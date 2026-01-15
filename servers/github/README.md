# GitHub MCP Server

A comprehensive GitHub integration for the Model Context Protocol (MCP) that enables repository browsing, code exploration, and metadata access.

## Overview

The GitHub MCP Server provides read-only access to GitHub repositories, allowing AI agents to explore codebases, view file contents, and access repository information through the MCP protocol. This server is part of the MCP Suite monorepo and leverages shared utilities for consistent development patterns.

## Features

- **Repository Discovery**: List repositories for users and organizations
- **Repository Information**: Get detailed metadata about repositories
- **Code Browsing**: Explore repository contents, directories, and files
- **File Access**: Retrieve content of specific files
- **Search**: Search for repositories across GitHub
- **Documentation**: Access README files and repository documentation
- **Branch Management**: List repository branches
- **Language Analysis**: View programming language statistics
- **Contributor Information**: Access repository contributor data

## Setup

### Prerequisites

- Node.js 18+
- GitHub personal access token (classic or fine-grained)
- Access to GitHub repositories (public or private depending on token scope)

### Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Required: GitHub personal access token
GITHUB_TOKEN=your_github_token_here

# Optional: GitHub Enterprise base URL (leave empty for github.com)
GITHUB_BASE_URL=
```

### Token Scopes

For basic repository viewing, your GitHub token should have the following scopes:
- `public_repo` - Access public repositories
- `repo` - Access private repositories (if needed)

### Installation

The server is available as an npm package:

```bash
npm install -g @imazhar101/mcp-github-server
```

Or run directly with npx:

```bash
npx @imazhar101/mcp-github-server
```

## Usage

### Direct Execution

```bash
# With environment variables set
mcp-github

# Or specify token directly
GITHUB_TOKEN=your_token mcp-github
```

### MCP Configuration

#### Continue.dev

Add to your `continue/config.yaml`:

```yaml
mcpServers:
  - name: GitHub Repository Viewer
    command: npx
    args:
      - "@imazhar101/mcp-github-server"
    env:
      GITHUB_TOKEN: "your_github_token"
```

#### Claude Code

```bash
claude mcp add github-viewer \
  -e GITHUB_TOKEN="your_github_token" \
  -- npx @imazhar101/mcp-github-server
```

#### Cline (VS Code)

Add to your MCP settings:

```json
{
  "mcpServers": {
    "github-viewer": {
      "command": "npx",
      "args": ["@imazhar101/mcp-github-server"],
      "env": {
        "GITHUB_TOKEN": "your_github_token"
      }
    }
  }
}
```

## Available Tools

### list_user_repositories
List repositories for a specific GitHub user or organization.

**Parameters:**
- `username`: GitHub username or organization name
- `type`: Repository type (`all`, `owner`, `member`) - default: `owner`
- `sort`: Sort by (`created`, `updated`, `pushed`, `full_name`) - default: `updated`
- `direction`: Sort direction (`asc`, `desc`) - default: `desc`
- `per_page`: Results per page (1-100) - default: 30
- `page`: Page number - default: 1

### get_repository
Get detailed information about a specific repository.

**Parameters:**
- `owner`: Repository owner (username or organization)
- `repo`: Repository name

### list_repository_contents
List files and directories in a repository path.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `path`: Path within repository (default: root)
- `ref`: Branch, tag, or commit SHA

### get_file_content
Get the content of a specific file in a repository.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `path`: Path to the file
- `ref`: Branch, tag, or commit SHA

### search_repositories
Search for repositories on GitHub using keywords.

**Parameters:**
- `q`: Search query (supports GitHub search syntax)
- `sort`: Sort by (`stars`, `forks`, `help-wanted-issues`, `updated`)
- `order`: Sort order (`asc`, `desc`) - default: `desc`
- `per_page`: Results per page (1-100) - default: 30
- `page`: Page number - default: 1

### get_repository_readme
Get the README content of a repository.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `ref`: Branch, tag, or commit SHA

### list_branches
List branches in a repository.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `protected`: Only return protected branches
- `per_page`: Branches per page (1-100) - default: 30
- `page`: Page number - default: 1

### list_languages
List programming languages used in a repository.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name

### list_contributors
List contributors to a repository.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `anon`: Include anonymous contributors - default: false
- `per_page`: Contributors per page (1-100) - default: 30
- `page`: Page number - default: 1

### get_repository_stats
Get repository statistics (stars, forks, etc.).

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name

## API Rate Limits

GitHub's API has rate limits that depend on authentication:
- **Authenticated requests**: 5,000 requests per hour
- **Unauthenticated requests**: 60 requests per hour

The server will automatically handle rate limiting and return appropriate error messages when limits are exceeded.

## Error Handling

The server provides detailed error messages for common issues:
- Authentication failures
- Repository not found
- Access denied
- Rate limit exceeded
- Network connectivity issues

## Security Considerations

- Store GitHub tokens securely and never commit them to version control
- Use fine-grained personal access tokens with minimal required scopes
- Regularly rotate tokens and revoke unused ones
- Consider using GitHub App authentication for production deployments

## Development

This server is part of the MCP Suite monorepo. To contribute:

1. Clone the repository
2. Install dependencies: `npm install`
3. Build shared modules: `npm run build:shared`
4. Build the server: `npm run build -- --server=github`
5. Test your changes

## License

MIT License - see the main repository for details.