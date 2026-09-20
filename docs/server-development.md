# Server development

## Locate the contract before changing it

Read the affected server's `package.json`, `tsconfig.json`, `src/index.ts`, and
README. Use PostgreSQL to understand a split implementation; inspect
Canvas for category-specific modules. ClickUp keeps handlers inline.

For a tool change, follow the advertised schema to its dispatch case, service
method, and formatted result. Clients consume the tool name, required arguments,
and MCP result/error shape. A TypeScript interface alone does not enforce runtime
input validation. Keep schemas, validation, and implementation consistent.

## Add a server

1. Create a focused `servers/<name>/` package with an explicit TypeScript entry
   point, manifest, compiler configuration, and README. Dependency/build changes
   require authorization under [AGENTS.md](../AGENTS.md).
2. Separate transport/dispatch, tool contracts, and provider calls when useful.
   Reuse shared helpers only after checking their actual behavior.
3. Keep credentials in the process environment. Define required variables and
   failure behavior; avoid network requests merely to discover tool schemas.
4. Add offline tests for validation, dispatch, response normalization, and errors.
   Use an explicitly authorized isolated environment for live checks.
5. Update the root service catalog and relevant setup examples. Reconcile retained
   registry metadata in `config/servers.json` when appropriate; it is not an
   automatic runtime loader.
6. Check build discovery and release selection separately. The build script scans
   `servers/*/`; `scripts/publish.js` has a hardcoded server list. Inclusion in one
   does not imply inclusion in the other. Publishing changes require their own scope.

## Local build commands

Run from the repository root with already-installed project dependencies:

```sh
npm run build -- --server=postgresql
npm run build -- --server=all
npm run build:shared
```

`npm run build` without arguments opens the interactive menu after building shared
modules. `node scripts/build.js` does the same. The extra `--` forwards options
to `parseCommandLineArgs` in [scripts/build.js](../scripts/build.js).

The build first compiles shared sources, then runs TypeScript with a server-local
`--outDir`. For example, PostgreSQL has `rootDir: ../../`, so its source entry
is emitted under `servers/postgresql/dist/servers/postgresql/src/index.js`.
Verify the actual output and manifest `bin` before configuring a client; a generic
`dist/index.js` command is not reliable across this repository.

The shared build emits next to source and also creates `dist/shared/package.json`.
Inspect Git status after building, including generated files. Do not edit emitted
files by hand or delete artifacts as an incidental cleanup step.

## Running and connecting

Building does not start a server. After an authorized build, a client launches
Node with the verified compiled entry point and appropriate environment. Startup
may initialize provider clients, databases, or a browser. Consult the server README
and [MCP setup guide](MCP_SETUP_GUIDE.md) for client examples; verify examples against
the actual package and runtime. These docs do not authorize global installation.

## Release scripts are mutating operations

[scripts/publish.js](../scripts/publish.js) can bump versions and calls public
`npm publish`. [scripts/deploy.js](../scripts/deploy.js) describes a sequence that
changes a manifest, builds, publishes, stages/commits it, creates a tag, and pushes
the tag. Neither is a validation command or a dry run. Their execution and module
compatibility were not tested during mapping.

The root `clean` script deletes root `dist/`; it is not a complete cleanup of
server-local outputs. Deletion requires explicit authorization.

See [testing](testing.md) for checks and known limitations. This guide owns
build and server-development procedures; provenance is in the
[overview](overview.md).
