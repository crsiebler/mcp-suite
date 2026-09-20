# Architecture

## Ownership and boundaries

| Area | Responsibility and evidence |
| --- | --- |
| `servers/<name>/src/index.ts` | Process startup, MCP capabilities/handlers, dispatch, response formatting, and transport |
| Server `tools/` | Advertised names and JSON input schemas; most split servers export a tool array |
| Server `services/` | Provider API calls and domain operations |
| Server `types/` or `types.ts` | Provider-specific request and response types |
| `shared/types/` | `ServerResponse`, configuration/logging types, and local MCP descriptions |
| `shared/utils/` | Environment lookup, logging, and validation helpers |
| `shared/middleware/` | Authentication/header and error helpers, used where explicitly imported |
| `scripts/` | Build and release orchestration, separate from server runtime |

These are conventions, not a shared server framework. ClickUp keeps its tool
handlers in `src/index.ts`. Canvas has category-specific tool and service modules. Do not assume every server has a `handlers/` directory or uses
all shared middleware.

## Representative request path

[PostgreSQL's entry point](../servers/postgresql/src/index.ts) reads its connection
string and operation policy from the environment, constructs PostgreSQLService,
and registers MCP handlers. The list handler returns `postgresqlTools`; tool calls
are dispatched and formatted into MCP responses. `run()` connects stdio transport.
The service delegates database operations to a `pg.Pool` through
[PostgreSQLService](../servers/postgresql/src/services/postgresql-service.ts).
SQL validation and transaction behavior belong to that service, not MCP itself.
Do not equate advertised read-only settings with a completed security audit.

## Configuration and external effects

[Environment helpers](../shared/utils/config.ts) read `process.env`; they do not
load `.env` files. The launching environment/client must supply credentials.
Inspect each constructor for required variables and defaults.

`config/development.json`, `config/production.json`, and `config/servers.json`
are retained configuration/registry documents. Inspection found no references
loading those filenames in the TypeScript/JavaScript runtime or scripts. Editing
a registry entry alone does not implement or enable a server.

[Logger](../shared/utils/logger.ts) writes debug/info through `console.debug`
and `console.info`, and warning/error through `console.warn` and `console.error`.
It serializes supplied data without redaction. This matters for stdio and private
data: callers must not assume every level is protocol-safe or secret-safe.

## Source and generated ownership

TypeScript is the editable source. Tracked `.js`, `.d.ts`, and map files sit next
to shared sources. [shared/tsconfig.json](../shared/tsconfig.json) emits into the
shared directory, while the root config targets `dist/`. Server configs and the
build script determine each server's local output layout. See
[server development](server-development.md) before changing or invoking builds.

Some servers also have a top-level `index.ts` re-export shim. Its existence does
not prove it is included in that server's build. Manifests use the `@crsiebler` npm scope and repository URLs under
`crsiebler/mcp-suite`. These source names do not establish npm publication or
transfer of previously published packages. Package author metadata identifies Cory <cory.siebler@phitechsolutions.com>;
original implementation credit is retained in the root README.

## Verification and limits

See [testing](testing.md). This map traces representative static flows, not every
API operation. It does not establish live authentication, protocol compatibility,
provider permissions, logging safety, or parity between checked-in and published
artifacts. Provenance is in the [overview](overview.md).


## External replacements

Jira is now provided by the official hosted Atlassian Rovo MCP rather than a local
package. See [Rovo setup](atlassian-rovo.md) for authentication and site routing.
