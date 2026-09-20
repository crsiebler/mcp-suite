# Testing and verification

## Choose checks by their effects

The scripts in [package.json](../package.json) are the command source. Dependencies
must already be installed; do not let `npx` silently download missing tools.

| Command | Purpose and prerequisites |
| --- | --- |
| `npm run type-check` | Root TypeScript check; requires local TypeScript and dependency types |
| `npm run lint` | ESLint for `.ts`/`.js`; requires installed ESLint and a usable configuration |
| `npm test -- tests/unit/shared-utils.test.ts` | Focused validation-helper tests |
| `npm test -- tests/integration/<name>-server.test.ts` | Selected integration file; inspect environment and external effects first |
| `npm test` | All discovered Vitest tests, including integration files |
| `npm run test:watch` | Interactive Vitest watch mode |

The root TypeScript config excludes test files. A passing root typecheck does not
establish that integration-test imports match the installed MCP SDK.

No tracked ESLint configuration, Vitest configuration, Markdown formatter, or
formatter script was found during this mapping. A lint script alone does not
prove lint is runnable. Keep formatting consistent and report unavailable tooling;
do not add dependencies/configuration merely to make a documentation check run.

## Current test coverage and limits

| Source | Observed behavior |
| --- | --- |
| [Shared utility tests](../tests/unit/shared-utils.test.ts) | Exercises required values, email/URL validation, and sanitization; no service credentials needed |
| [Flight integration](../tests/integration/flight-server.test.ts) | Credential-gated Duffel calls; reads `DUFFEL_ENVIRONMENT`, defaulting to test |

Several tests return early instead of reporting formal skips. Some expect
`dist/index.js`. Verify output locations
before running integration tests. The Flight client imports and transport
construction must be checked against installed SDK versions before claiming those
suites are executable.

The [integration README](../tests/integration/README.md) describes the retained
Flight checks. CI alone does not disable every provider test.

## Adding meaningful checks

For behavior changes, first reproduce the failure with an isolated test. Mock the
provider boundary for ordinary dispatch/validation/normalization tests; assert
actual results and error shapes. Add a stdio integration check when transport
behavior changes. Separate live-provider validation from offline checks, and
report skipped/unavailable coverage explicitly.

For documentation-only work, validate relative links, referenced paths, command
syntax against scripts, and `git diff --check`. Recheck substantive relationships
in source. Do not start services, install dependencies, or run live integration
calls just to validate a repository map.

## Mapping verification snapshot

On 2026-09-19, project `node_modules` was absent. Typecheck, lint, builds, and tests
were not run; no dependencies were installed. No configured Markdown formatter
was found. Documentation verification is reported with the migration handoff;
this snapshot does not claim runtime success. Source provenance is in the
[overview](overview.md).
