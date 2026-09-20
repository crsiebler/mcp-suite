# Atlassian Rovo MCP

The local Jira server has been removed. The official Cloud endpoint is
`https://mcp.atlassian.com/v2/mcp`. Connect directly from an HTTP-capable MCP
client; no local server, npm package, or bridge is needed for OpenCode.

## Authentication

OAuth is Atlassian's recommended interactive option and needs no personal-token
environment variables. For personal API tokens, an organization administrator
must enable API-token authentication. Create a scoped token with the relevant
`agent-interface` permissions. An existing unscoped Jira REST token is not proof
of compatibility. Personal API tokens use Basic authentication with the token
owner's email, not Bearer authentication. Service-account API keys use Bearer.

For Jira reads/search, select `read:jira:agent-interface` and
`search:jira:agent-interface`. Add `write:jira:agent-interface`,
`delete:jira:agent-interface`, and `manage:jira:agent-interface` only for needed
operations. Existing user permissions still apply.

## Environment variables and multiple sites

Rovo does not prescribe environment variable names: the client sends an
Authorization header. Suggested names for two independently managed credentials:

| Variable | Value |
| --- | --- |
| `ATLASSIAN_ASU_EMAIL` | First token owner's Atlassian email |
| `ATLASSIAN_ASU_API_TOKEN` | First scoped personal API token |
| `ATLASSIAN_ASU_AUTH_HEADER` | `Basic ` followed by base64 of `email:token` |
| `ATLASSIAN_OTHER_EMAIL` | Second token owner's email |
| `ATLASSIAN_OTHER_API_TOKEN` | Second scoped personal API token |
| `ATLASSIAN_OTHER_AUTH_HEADER` | Independently derived Basic header |

Load credentials privately into the launching shell or through a secret manager.
With email/token variables already set, derive a header without printing it:

```sh
export ATLASSIAN_ASU_AUTH_HEADER="Basic $(printf '%s:%s' "$ATLASSIAN_ASU_EMAIL" "$ATLASSIAN_ASU_API_TOKEN" | base64 | tr -d '\r\n')"
```

Repeat with the OTHER variables for the other connection. The header itself is
a credential; base64 is encoding, not encryption. OpenCode only needs the derived
header variables in this configuration; email/token names are preparation inputs.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "atlassian_asu": {
      "type": "remote",
      "url": "https://mcp.atlassian.com/v2/mcp",
      "oauth": false,
      "headers": {
        "Authorization": "{env:ATLASSIAN_ASU_AUTH_HEADER}"
      }
    },
    "atlassian_other": {
      "type": "remote",
      "url": "https://mcp.atlassian.com/v2/mcp",
      "oauth": false,
      "headers": {
        "Authorization": "{env:ATLASSIAN_OTHER_AUTH_HEADER}"
      }
    }
  }
}
```

Use project-scoped configuration to expose only the relevant connection when
working in one organization. Retain tool approval rules appropriate to each
project; these examples do not grant automatic approval for writes.

API tokens are not bound to a single cloud ID by the MCP connection. Pass the
correct `cloudId` to tools that require it. Record each project's intended site
and verified cloud ID in project guidance, along with its MCP connection name.
An optional `ATLASSIAN_ASU_CLOUD_ID` is a local convention only: the server does
not automatically consume it or treat it as an access restriction. Connection
names likewise do not enforce site isolation. Credential permissions and
organization policy remain the actual access boundary. One credential may
access multiple sites; separate tokens can simplify rotation and ownership.

The old local server's `JIRA_BASE_URL`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` are not
automatically read by Rovo. No global configuration, credentials, or installed
connections were migrated as part of removing the repository implementation.

## Sources and verification

Checked against official documentation on 2026-09-19:

- [Atlassian API-token authentication](https://developer.atlassian.com/cloud/rovo-mcp/guides/configuring-authentication-via-api-token/)
- [Atlassian supported tools](https://developer.atlassian.com/cloud/rovo-mcp/guides/supported-tools/)
- [OpenCode remote MCP configuration](https://opencode.ai/docs/mcp-servers/)

The example was checked as JSON, not authenticated against a live tenant. Token
eligibility, admin enablement, and tool permissions require account-side checks.
