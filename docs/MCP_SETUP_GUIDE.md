# MCP setup

Use the [generated catalog](server-catalog.md) for all seven retained servers,
exact tool names, environment settings and repository-relative entry points.
The catalog distinguishes startup requirements from conditional provider credentials.
Server READMEs own provider-specific options and limitations. AI Job Search's provider
contract remains unverified; Canvas can expose selected tool categories.

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
