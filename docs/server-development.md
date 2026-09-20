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
network guard prevent provider access. Logger output is suppressed with LOG_LEVEL
error for this packaging check; protocol logging safety is a separate story.

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
