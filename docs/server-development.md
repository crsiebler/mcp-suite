# Server development

## Package and tool contracts

Node.js 22.14.0 or newer is required by the repository and all seven packages.
The private root owns installation, verification and orchestration. npm workspaces
in root package.json discover the seven packages under servers/. Install the root
lockfile with `npm ci`; do not create per-server lockfiles. Package versions remain
independent. Adding a server means adding its manifest/source/configuration under
the workspace pattern, not maintaining another handwritten build list.

Read the affected package manifest, compiler configuration, entry point and README.
Follow each advertised tool schema through dispatch, service calls and result
formatting. Keep tool names, required arguments and MCP error/result shapes aligned.
Use environment variables for credentials and offline fixtures for ordinary tests.
A TypeScript interface does not validate runtime input.

## Build and pack

Run these commands from the repository root after installation:

```sh
npm ci
npm run build
npm run build -- --server=postgresql
npm run build -- --list
npm run build:shared
npm run build --workspace=@crsiebler/mcp-postgresql-server
npm pack --workspace=@crsiebler/mcp-postgresql-server --pack-destination=dist
```

The default build is non-interactive and builds all workspaces. `--server=all`
remains supported. The script resolves the repository from its own location, so
`node /absolute/path/to/mcp-suite/scripts/build.js --server=postgresql` also works
from another directory. Invalid arguments fail before compilation. Only the
installed TypeScript compiler is invoked; no automatic downloads occur.

The build wrapper validates shared sources first, then compiles the selected
packages. Each package includes its own compiled shared modules, preserving the
relative imports under dist/. For example, PostgreSQL's manifest entry is
`servers/postgresql/dist/servers/postgresql/src/index.js` and its shared code is
`servers/postgresql/dist/shared/`. There is no published shared package and no
runtime dependency on the source checkout. Standalone shared output is under
`dist/shared/`; generated JavaScript, declarations and maps never belong beside
shared TypeScript sources.

Selected build output is cleared before compilation to avoid stale packed files.
The build owns only root dist/shared and selected server dist directories. It
reports compiler diagnostics on stderr and fails on the first compiler error.
Package `prepack` invokes the same selected-server build, so `npm pack` and
`npm publish` build current source. There is no additional prepublishOnly build.
Packing, including dry runs, can execute lifecycle hooks; it is not read-only.

Inspect tarball contents and verify main/bin/start paths, rather than assuming
`dist/index.js`. `tests/packaging/packages.test.ts` runs real prepack hooks, installs
all seven tarballs offline from the npm cache, and initializes/lists tools through
an SDK client from another working directory. Synthetic settings and a child
network guard prevent provider access. Debug-level stderr is captured separately;
initialization, discovery and unknown-tool calls must produce no protocol errors.

## Running and extending

Building and packing do not launch a server. A client launches the manifest entry
with its required environment. Use the selected README and
[MCP setup](MCP_SETUP_GUIDE.md); these instructions do not authorize global installs.

For a new server, add focused transport/dispatch, provider and schema modules as
needed. Update the repository catalog and docs, add offline contract/package tests,
and verify that the workspace inventory includes the package. Configuration in
config/servers.json remains inactive legacy metadata until US-013 reconciles it.

## Releases

The root is private and must not be published. `npm run release:publish` temporarily
names the legacy publication wrapper, avoiding npm's reserved publish lifecycle
hook; it is not a validation command. It and `npm run deploy` remain unsafe legacy
release paths scheduled for replacement by Changesets in US-014/015. Do not execute
them during verification: they can change versions, publish, commit and push tags.

See [testing](testing.md) for required checks. Shared source changes affect every
package that bundles them and will require matching release notes/version choices
when the Changesets contribution workflow is introduced.


## Server diagnostics

Use `Logger` from `shared/utils/logger.ts`; stdout is reserved for MCP messages.
Every enabled level emits one JSON line to stderr (at most 8192 UTF-8 bytes
including the newline). Context, static operation messages, numeric counts/status
and conventional machine error codes are useful diagnostics.

Never interpolate SQL, provider errors, URLs, user input or private payloads into
messages. Do not attach complete request/response objects. Known credential and
payload fields are redacted recursively, URL/auth text is scrubbed, and errors
are reduced to machine code/status without messages, stacks or attached bodies.
These protections cannot recognize arbitrary private prose; minimal call-site
metadata is required. Error arguments may be unknown rejection values.

Serialization handles cycles, BigInt and inaccessible properties without calling
custom getters or `toJSON`. Depth, field count, traversal and output are bounded;
large details/context are replaced with truncation markers. Synchronous diagnostic
failures are swallowed so they do not replace the operation result. Logs are
best-effort diagnostics, not an audit record or a durable sink.


## Configuration and input validation

Required settings use `getEnvVar`: missing, empty and whitespace-only values fail
with the setting name. Nonempty values are returned byte-for-byte, including
credential whitespace. Defaults apply only when a variable is absent; unset an
optional setting to use its default. `getOptionalEnvVar` preserves an explicitly
empty string. Environment names are unchanged.

| Setting | Accepted value / default |
| --- | --- |
| `AIJOBSEARCH_API_URL` | HTTP(S) base endpoint; default `https://api-main-poc.aiml.asu.edu` |
| `CANVAS_BASE_URL` | Required HTTP(S) base endpoint |
| `ELASTICSEARCH_NODE` | HTTP(S) base endpoint; default `http://localhost:9200` |
| `ELASTICSEARCH_MAX_RETRIES` | Decimal integer 0–10; default 3; zero disables retries |
| `ELASTICSEARCH_REQUEST_TIMEOUT` | Decimal integer 1–300000 milliseconds; default 30000 |
| `DUFFEL_ENVIRONMENT` | Exactly `test` or `live`; default `test` |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` (case-insensitive); default `info` |

Base endpoints reject embedded credentials, whitespace, backslashes, query
strings, fragments and non-HTTP schemes. Explicit local HTTP hosts and path
prefixes remain supported. Validation does not resolve DNS or impose a host
allowlist; this is endpoint syntax validation, not an SSRF security boundary.
No new filesystem inputs or path policy are introduced. The older `validateUrl`
helper checks URL syntax only and is not an endpoint/security validator.

Compatibility changes: supplied blank settings and malformed numbers/enums now
fail instead of silently selecting defaults, accepting numeric prefixes or
passing invalid values to providers. Elasticsearch startup failures exit nonzero;
configuration errors identify the setting without printing its value. Required
Canvas/ClickUp tokens use the same blank-value checks as ASU and Flight. Token
bytes, credential choice, authentication flows and authorization rules are unchanged.
PostgreSQL's dangerous-operation flag and Salesforce's optional OAuth setup keep
their existing parsing/behavior under the no-authentication-change boundary.

Shared helpers also provide strict `true`/`false` boolean parsing with an explicit
default; they do not add new environment settings. Use typed validation for an
actual operation rather than inventing generic string cleanup. The unused
`sanitizeString` export was removed; `requireText` rejects non-string/blank input
and returns exact text. ASU extraction taxonomy/context and text-mode matching
use it, preserving spaces, newlines and angle brackets. This does not HTML-escape
text or validate the remote ASU taxonomy contract; callers must apply the rules
of their own operation. The auth middleware's existing validators are unchanged.


## Shared result migration

`ServerResponse<T>` is a discriminated success-with-data or failure-with-error
union; use `unknown` at unvalidated external boundaries. `McpTool`, `McpResource`
and `McpPrompt` alias installed SDK types without changing SDK versions.
AI Job Search is the first fully migrated dispatch consumer. Do not assume other
servers already expose this envelope; see its [migration notes](../servers/aijobsearch/README.md#response-contract).

Preserve original provider errors until `normalizeFailure` can classify metadata,
then pass the safe result through `toMcpResult`. Do not interpolate error messages
or attach raw response bodies. Use field-only `InputError` for validation failures.
Retry-After is advisory; the helpers do not retry operations. Test both success and
failure MCP results against the installed SDK schemas and preserve provider tests.
The unused generic ErrorHandler has been removed; unused auth middleware remains
unchanged and must not be enabled as a side effect of this workflow.
