# Repository map

MCP Suite contains independently launched TypeScript MCP servers for external
services, with shared utilities and repository-level build/test scripts. Coding
assistant integration is client configuration, not a dependency on Claude Code.

## Find the relevant context

| Task or subject | Documentation | Source entry points |
| --- | --- | --- |
| Trace requests and shared behavior | [Architecture](architecture.md) | `servers/*/src/index.ts`, `shared/` |
| Add a server or tool; build locally | [Server development](server-development.md) | `scripts/build.js`, server manifests and tool definitions |
| Choose checks and understand coverage | [Testing](testing.md) | `package.json`, `tests/`, TypeScript configs |
| Connect an MCP client | [MCP setup](MCP_SETUP_GUIDE.md) | Actual built entry point and server constructor environment reads |
| Find service-specific options | [Generated server catalog](server-catalog.md) and each server README | `servers/<name>/src/` |
| Agent obligations and approvals | [AGENTS.md](../AGENTS.md) | Canonical repository policy |

The root README links to the generated service catalog. Individual server
READMEs own provider setup details. This map owns engineering navigation and
observed relationships; it does not establish published-package availability.

## Scope and provenance

Inspected on 2026-09-19 against commit `2a2881a`; the worktree was clean before
this documentation migration. The resulting uncommitted documentation changes
are not part of that commit.

Inspection covered root manifests, build/release scripts, shared TypeScript,
representative PostgreSQL request paths, Canvas/ClickUp
entry-point variations, and all current test-file categories. Other service
implementations were inventoried rather than exhaustively reviewed. No live
provider, deployment, package publication, or MCP-client connection was tested.

Known source/documentation discrepancies and verification limits are recorded in
the subject guides. Follow current source when old package examples, tool counts,
or generated paths disagree; report the discrepancy instead of assuming parity.

The active catalog now contains seven servers after the requested removal of
ten vendor-overlapping integrations. Historical release notes describe earlier
releases and are not the current catalog.


Current inventory derives from npm workspaces and each manifest's `mcpSuite`
metadata, validated against source environment readers and built tool exports.
The unused environment JSON files and orphan Jira fixture were removed. Historical
releases retain earlier inventories; they are not setup guidance. See
[license provenance](licensing.md) for the unresolved original notice.
