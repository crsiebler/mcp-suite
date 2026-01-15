# GitHub Server Integration Tests

This directory contains integration tests for the GitHub MCP server following secure, portable patterns.

## Testing Philosophy

The GitHub integration tests follow the **Option 1 + Option 4 combo approach**:

1. **No Hardcoded Credentials**: Tests never contain hardcoded tokens or personal repositories
2. **Public Repository Focus**: Uses stable public repositories by default (`microsoft/vscode`)
3. **Environment-Aware**: Gracefully skips tests in CI environments
4. **Configurable**: Supports custom repository configuration via environment variables

## Test Structure

### Default Public Repository Tests
- **Repository**: `microsoft/vscode` (180k+ stars, TypeScript project)
- **Fallback**: `facebook/react` (242k+ stars, JavaScript project)
- **Coverage**: All 10 GitHub MCP server tools tested against real public data

### Authenticated Tests (Optional)
- **Only when `GITHUB_TOKEN` is provided**: Tests personal repository access
- **Repository**: Uses personal repositories for authenticated-only operations

### Error Handling Tests
- **404 Scenarios**: Non-existent repositories and files
- **Authentication Failures**: Invalid token scenarios
- **Edge Cases**: Network failures, rate limiting behavior

## Environment Variables

```bash
# Optional: Override default test repository
GITHUB_TEST_REPO='{"owner":"custom","repo":"repository"}'

# Optional: Enable authenticated testing
GITHUB_TOKEN=your_github_token_here

# Optional: GitHub Enterprise endpoint
GITHUB_BASE_URL=https://your.github-enterprise.com/api/v3

# Skip tests in CI environments
CI=true
```

## Running Tests

```bash
# Run all tests (uses public repos by default)
npm test -- github-server

# Run with authentication
GITHUB_TOKEN=your_token npm test -- github-server

# Skip in CI (automatic)
CI=true npm test -- github-server
```

## Test Coverage

✅ **All 10 GitHub MCP Server Tools Tested**:
- `list_user_repositories` (authenticated only)
- `get_repository` 
- `list_repository_contents`
- `get_file_content`
- `get_repository_readme`
- `list_branches`
- `list_languages` 
- `list_contributors`
- `search_repositories`
- `get_repository_stats`

✅ **Security**: No hardcoded credentials in test files
✅ **Portability**: Works for any developer/environment  
✅ **Robustness**: Comprehensive error handling and edge cases
✅ **CI-Friendly**: Graceful behavior in continuous integration