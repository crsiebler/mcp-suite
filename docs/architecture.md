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
| `scripts/`                    | Build and catalog generation, separate from server runtime                            |

These are conventions, not a shared server framework. ClickUp separates transport, tool schemas, validation and provider mappings. Canvas has category-specific tool and service modules. Do not assume every server has a `handlers/` directory or uses
all shared middleware.

## Workspace and package output

The private root and root package-lock.json own six npm workspaces. Package
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

`config/servers.json` is generated inventory, not runtime configuration.
`npm run catalog:generate` builds the workspaces and derives it and
[server-catalog.md](server-catalog.md) from package `mcpSuite` metadata and actual
tool exports. Environment names are checked against literal source readers;
packaged tests check required startup settings and discovered tool names.
Unused development/production JSON was removed; no configuration loader was added.
Environment variables remain the runtime configuration source.

[Logger](../shared/utils/logger.ts) emits bounded JSON diagnostics exclusively to
stderr and redacts known sensitive fields. Callers still use static messages and
minimal metadata because arbitrary private prose cannot be recognized reliably.

## Shared results and errors

Shared helpers normalize failures into safe categories and serialize MCP results.
Handlers choose their public success shapes; no suite-wide envelope is implied.
Preserve provider metadata for classification, avoid returning raw failure bodies,
and test the selected handler against the installed SDK schema. Shared helpers
provide retry metadata but do not retry operations.

The generic ErrorHandler had no production imports and was removed. Unused
`shared/middleware/auth.ts` remains quarantined and unchanged under repository
policy; do not adopt or remove it as part of unrelated error work. Retained servers
use their documented response contracts.

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


## ClickUp tool boundary

`servers/clickup/src/index.ts` retains the Axios credential setup and MCP transport.
`tools.ts` combines three domain schema arrays; `handler.ts` resolves the advertised
name, validates arguments through `input.ts`, and formats raw successes or safe
shared failures. `provider.ts` owns the 29 request mappings and Workspace-member
projection. Required input migrations and pagination limits are in the
[ClickUp guide](../servers/clickup/README.md#contracts-and-migration).

## Release metadata

Npm workspaces discover packages for both builds and Changesets. The pinned CLI
consumes `.changeset/*.md` into independent package versions and changelogs; its
config excludes private-root versioning/tagging. Root scripts synchronize the lock
and regenerate catalog versions after preparation. Shared code is copied, so
contributors must select affected consumers explicitly. Package changelogs own
future release statements; releases/ preserves historical records. See
[releasing](releasing.md) for the local branch boundary and pending hosted activation.

`.github/workflows/verify.yml` owns pull-request checks. The manual-only
`release.yml` uses pinned Changesets version/publish sub-actions, a separate
candidate artifact job and the protected `npm-publish` environment. Only that
publication job receives OIDC permission. `scripts/release-artifacts.cjs` validates
workspace membership, manifests, version notes, tarball hashes/source receipts and
fresh registry-plan agreement; it never calculates versions or publishes.
The packaging suite accepts `MCP_RELEASE_PACK_DIR` to test already-packed release
subsets without prepack/build. GitHub announcement glue verifies the remote tag's
commit and selects package changelog prose after confirmed npm publication.
