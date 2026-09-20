# Architecture

## Ownership and boundaries

| Area                          | Responsibility and evidence                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `servers/<name>/src/index.ts` | Process startup, MCP capabilities/handlers, dispatch, response formatting, and transport |
| Server `tools/`               | Advertised names and JSON input schemas; most split servers export a tool array          |
| Server `services/`            | Provider API calls and domain operations                                                 |
| Server `types/` or `types.ts` | Provider-specific request and response types                                             |
| `shared/types/`               | Discriminated `ServerResponse`, configuration/logging types, and installed SDK MCP aliases                |
| `shared/utils/`               | Environment lookup, logging, validation, safe errors and MCP result serialization                                      |
| `shared/middleware/`          | Unused authentication helper retained unchanged; generic error middleware removed                  |
| `scripts/`                    | Build and release orchestration, separate from server runtime                            |

These are conventions, not a shared server framework. ClickUp keeps its tool
handlers in `src/index.ts`. Canvas has category-specific tool and service modules. Do not assume every server has a `handlers/` directory or uses
all shared middleware.

## Workspace and package output

The private root and root package-lock.json own seven npm workspaces. Package
metadata is the shared discovery source in scripts/packages.cjs. The build wrapper
uses argument arrays and an installed compiler, checking shared sources before
selected package builds. Each package ships its nested dist/servers/<name>/src
entry plus dist/shared runtime modules; imports stay inside the package. Generated
shared output is no longer tracked beside source. Package prepack builds current
source and keeps npm pack JSON output free of progress messages.

See [server development](server-development.md) for commands and
[testing](testing.md) for tarball verification and limits. This packaging model does
not publish a separate shared package; shared changes can affect multiple releases.

## Representative request path

[PostgreSQL's entry point](../servers/postgresql/src/index.ts) reads its connection
string and operation policy from the environment, constructs PostgreSQLService,
and registers MCP handlers. The list handler returns `postgresqlTools`; tool calls
are dispatched and formatted into MCP responses. `run()` connects stdio transport.
[PostgreSQLService](../servers/postgresql/src/services/postgresql-service.ts)
preserves operation checks and delegates client ownership/transactions to
[query execution](../servers/postgresql/src/services/query-execution.ts).
[PostgreSQL configuration](../servers/postgresql/src/config.ts) owns verified TLS,
managed connection options and execution/result bounds. SQL passes unchanged;
response truncation does not bound driver buffering. See the
[server guide](../servers/postgresql/README.md) for migration and outcome limits.
SQL validation and transaction behavior belong to the service, not MCP itself.
Do not equate advertised read-only settings with a completed security audit.

## Configuration and external effects

[Environment helpers](../shared/utils/config.ts) read `process.env`; they do not
load `.env` files. The launching environment/client must supply credentials.
Inspect each constructor for required variables and defaults.

`config/development.json`, `config/production.json`, and `config/servers.json`
are retained configuration/registry documents. Inspection found no references
loading those filenames in the TypeScript/JavaScript runtime or scripts. Editing
a registry entry alone does not implement or enable a server.

[Logger](../shared/utils/logger.ts) emits bounded JSON diagnostics exclusively to
stderr and redacts known sensitive fields. Callers still use static messages and
minimal metadata because arbitrary private prose cannot be recognized reliably.

## Shared results and errors

[AI Job Search dispatch](../servers/aijobsearch/src/tools/handler.ts) is the first
consumer of the discriminated `ServerResponse` contract. Services validate unknown
arguments, preserve original provider failures for metadata classification, and
return unknown provider data. The tool boundary uses
[error normalization](../shared/utils/errors.ts) and
[MCP serialization](../shared/utils/result.ts) for both operations. Failures expose
stable categories and safe messages, with bounded Retry-After advice where valid;
no requests are retried by these helpers. Unknown tool names remain protocol errors.

The generic ErrorHandler had no production imports and was removed. Unused
`shared/middleware/auth.ts` remains quarantined and unchanged under repository
policy; do not adopt or remove it as part of unrelated error work. Other servers
retain their existing response contracts until their focused migrations. See
[response migration](../servers/aijobsearch/README.md#response-contract) for the
client-visible ASU envelope change and its provider-schema limits.

## Source and generated ownership

TypeScript is the editable source. [shared/tsconfig.json](../shared/tsconfig.json)
emits into root `dist/shared`; server builds bundle shared output inside each
package's `dist/`. Generated siblings were removed from shared source. See
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


## Elasticsearch tool boundary

Elasticsearch's entry point owns stdio and existing credential configuration.
`servers/elasticsearch/src/handler.ts` dispatches the 18 tools and formats safe MCP
errors; `input.ts` checks required fields and advertised argument limits before
service calls. The service owns Elasticsearch request/response mappings, with
`services/outcomes.ts` reducing provider failure details to machine types.
Successful data shapes remain provider-specific; shared code does not own index
administration. See the server README for result migration and limit semantics.


## Canvas category registry

`servers/canvas/src/registry.ts` registers the 15 existing service/tool groups,
derives the 185-tool inventory, and uses one selected map for discovery and
execution. `CANVAS_TOOL_CATEGORIES` is optional; unset preserves all tools.
The entry point retains client/authentication configuration and stdio lifecycle.
Course-only opt-in pagination lives in `services/course-pagination.ts`; other
service contracts remain unchanged. See [Canvas tools](canvas-tools.md) for
categories, pagination and error-output migration.
