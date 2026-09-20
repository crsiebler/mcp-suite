# MCP setup

Use the [generated catalog](server-catalog.md) for all seven retained servers,
exact tool names, environment settings and repository-relative entry points.
The catalog distinguishes startup requirements from conditional provider credentials.
Server READMEs own provider-specific options and limitations. Canvas can expose
selected tool categories.

## Build locally

Requires Node.js 22.14.0 or newer. From the repository root:

```sh
npm ci
npm run build -- --server=postgresql
```

Configure your MCP client's stdio launcher with the Node executable, the **absolute**
path to the selected built entry, and its environment. For PostgreSQL:

```json
{
  "command": "node",
  "args": [
    "/absolute/path/to/mcp-suite/servers/postgresql/dist/servers/postgresql/src/index.js"
  ],
  "env": {
    "POSTGRESQL_CONNECTION_STRING": "postgresql://user:password@localhost:5432/database"
  }
}
```

This is a launcher fragment; the enclosing client configuration differs by harness.
Supply credentials through the client's supported environment mechanism or launching
shell, not committed configuration. These servers do not load `.env` files.
PostgreSQL verifies TLS by default; see its [TLS configuration](../servers/postgresql/README.md)
for trusted CA and explicit local non-TLS setup. Do not disable verification to
work around a production certificate problem.

Building does not start MCP. The client starts the process and owns stdio; stdout
is protocol-only and diagnostics use stderr. See [server development](server-development.md)
for package layout and [testing](testing.md) for offline checks. Startup/discovery
does not establish live provider permissions or certify every operation.

## Published packages

Manifests use the `@crsiebler` scope. Source renaming does not publish or transfer
packages. Verify registry ownership and the intended version before installing or
running a package. `npx` may download and execute code; installation and global
client configuration require their own authorization. Prefer the verified local
build while publication and [license provenance](licensing.md) remain unresolved.

Use each package's declared binary/main entry from the catalog; do not assume
`dist/index.js`. A repository entry includes `servers/<name>/` before its package's
`dist/`; installed-package paths start inside that package directory.

## Official Atlassian integration

The local Jira and Bitbucket servers were removed. Jira Cloud uses the official
[Atlassian Rovo MCP](atlassian-rovo.md), with its own authentication/site routing.
It is not launched from an mcp-suite package.

## Troubleshooting

- Missing entry: build the selected workspace and compare the catalog path.
- Missing setting: supply the named variable to the launched process; shell and
  client environments can differ.
- Provider denial: check the account and required permissions in the server guide.
- Tool mismatch: run `npm run catalog:check`, then restart the client-owned server
  with the intended build and any category-selection settings.
- Request uncertainty: follow the server's timeout/partial-result guidance before
  retrying a mutation. Tool annotations do not grant permission to perform writes.

## Jev in OpenCode and Codex

Build with `npm run build -- --server=jev` from the repository root. Replace the
absolute path placeholder below. Supply `AI_GATEWAY_API_KEY` through the environment
of the process launching the harness; GUI apps may not inherit your shell. Do not
paste a key into tracked configuration or tool arguments. No Vercel CLI, Docker,
hosting deployment or separate TypeSafe key is required.

OpenCode `opencode.json` fragment (merge with existing settings):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "jev": {
      "type": "local",
      "command": [
        "node",
        "/absolute/path/to/mcp-suite/servers/jev/dist/servers/jev/src/index.js"
      ],
      "environment": {
        "AI_GATEWAY_API_KEY": "{env:AI_GATEWAY_API_KEY}",
        "JEV_TIMEOUT_MS": "30000"
      },
      "enabled": true
    }
  }
}
```

Codex `config.toml` fragment (project-scoped `.codex/config.toml` requires trust):

```toml
[mcp_servers.jev]
command = "node"
args = ["/absolute/path/to/mcp-suite/servers/jev/dist/servers/jev/src/index.js"]
env_vars = ["AI_GATEWAY_API_KEY"]
tool_timeout_sec = 60

[mcp_servers.jev.env]
JEV_TIMEOUT_MS = "30000"
```

Codex `env_vars` forwards the named variable; OpenCode expands `{env:...}`. These
examples set no approval exceptions. Preserve the host's existing tool policy:
`jev_evaluate` sends supplied text externally and can incur charges despite its
read-only annotation. The 30-second server deadline is distinct from client tool
timeouts; if raising it, configure the client's call timeout accordingly.
Client MCP timeout settings do not change the server's evaluation deadline. Missing/blank keys fail startup; discovery does not evaluate anything.

After separately authorized configuration, verify discovery of `jev_evaluate`.
Use the [synthetic workflows](jev-workflows.md) only under the separate live
evaluation data/spend approval described there. Offline fixtures passed; account
access and real model quality remain unverified. No client configuration or global
installation was performed by this implementation.

Configuration fields follow official [OpenCode MCP documentation](https://opencode.ai/docs/mcp-servers/)
and [Codex MCP documentation](https://developers.openai.com/codex/mcp), checked
2026-09-20. This is an MCP tool integration, not a Jev chat-provider configuration.
