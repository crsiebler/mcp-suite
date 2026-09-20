# Testing and verification

Install locked root dependencies with `npm ci`. Run commands from the repository
root. The root lockfile installs all seven workspaces and their declared SDK versions.
No per-server lockfiles or installs are needed.

| Command                                         | Purpose                                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `npm run type-check`                            | Check source, tests and Vitest configuration without emitting files         |
| `npm run lint`                                  | ESLint correctness checks for TypeScript and handwritten JavaScript         |
| `npm run format -- <changed-files>`             | Format only intended changed files with Prettier                            |
| `npm run format:check -- <changed-files>`       | Check formatting of those files                                             |
| `npm test`                                      | Offline default; excludes the live Flight suite even when credentials exist |
| `npm test -- tests/unit/shared-utils.test.ts`   | Seven utility baseline tests                                                |
| `npm test -- tests/unit/duffel-service.test.ts` | Real Duffel service mapping with an Axios adapter fixture                   |
| `npm run test:watch`                            | Watch the same offline suite                                                |
| `npm run test:live`                             | Select live Flight tests; skipped unless explicitly enabled below           |

ESLint uses its recommended correctness rules. TypeScript owns symbol resolution
for `.ts` files; unused TypeScript declarations are not currently a baseline gate.
Generated shared JavaScript/declarations, build output and dependency trees are
excluded from lint. No rules from a previous lint configuration were removed.
Prettier uses double quotes and ES5 trailing commas. For small fixes in legacy
files, range-format the changed section rather than reformatting unrelated code.
Typechecking includes live tests even when they are skipped at runtime.

## Live Flight checks

Live execution requires all of: `RUN_LIVE_TESTS=1`, a `DUFFEL_API_KEY`, and
`DUFFEL_ENVIRONMENT=test` (the default). Obtain scoped approval and use an
appropriate test account before running against Duffel. Test mode is a declared
setting; it does not validate that the supplied token belongs to a test account.
Never echo credentials or forward provider diagnostics to test logs.

Build Flight first and verify its compiled entry path. The current TypeScript
layout produces `servers/flight/dist/servers/flight/src/index.js`. Keep this harness aligned when the packaging layout changes. The SDK stdio transport
owns its child process; close it after the suite, including failed setup.

These tests read provider data and create a flight offer request; they do not
book or cancel an order. Missing opt-in, credentials, or test mode causes six
formal skips. Skips are not proof of live compatibility. Do not run live tests as
part of ordinary validation, or enable them merely because credentials exist.

## Adding checks

Write meaningful failing regressions before behavior changes. For configuration
and mechanical fixes use native validation and existing characterization checks.
Keep real service logic and replace the provider boundary with realistic fixtures.
Do not treat a fake as proof of the live provider contract.

Source tests can explicitly import local `.ts` implementations under the root
no-emit compiler configuration. Shared generated siblings have been removed;
package builds keep emitted code under dist/. The packaging suite runs real
prepack hooks, installs tarballs using only the npm cache, and uses a real SDK
client to initialize/list tools with synthetic environment values and a process
network guard. It cleans up its own fixtures under dist/test-artifacts. No provider
requests are permitted. Successful discovery is not full tool-call coverage.

Keep provider-backed tests out of the default test configuration. Add ordinary
fixture integration tests under tests/ with `.test.ts` names. If another live
suite is added, update both Vitest configurations and its explicit opt-in guard.

Documentation validation uses link/path checks and `git diff --check`. Never
invoke release scripts as checks: they may publish packages and push tags.

## Verified baseline

US-001 uses Node v26.7.0, npm 11.19.0, TypeScript 5.9.3, Vitest 1.6.1,
ESLint 8.57.1 and Prettier 3.9.8. The root SDK is 0.5.0; server manifests still
request 0.5.x, 0.6.x and 1.x. This records the observed environment, not a claim
of runtime support across all declared versions. See docs/progress.md for actual
check results and the limitations of this initial verification story.

US-002 additionally verifies the frozen workspace install with engine-strict on
Node 22.14.0/npm 10.9.2, plus all seven builds, typecheck, lint and all 19 offline
tests. Node 22.14.0 is now the declared minimum for the root and all seven
packages. The test fixture validates all packages together using the locked graph;
it does not independently prove each package's production-only dependency closure.


## Diagnostic safety

`npm test -- tests/unit/logger.test.ts tests/unit/logging-callers.test.ts` checks
stderr routing, filtering, synthetic-secret redaction, bounded output, hostile
serialization and provider call-site privacy. Service tests replace only network
or database boundaries; no live requests or database changes occur.

Packaging checks run all seven installed tarballs with `LOG_LEVEL=debug`, capture
stderr to fixture-local files, and fail on SDK protocol parsing errors during
initialization, discovery and an unknown-tool call. They preserve the current
Salesforce failure envelope pending response normalization. This proves those
paths are protocol-safe, not every provider-backed operation; full tool coverage
remains separate. The root SDK 0.5 transport accepts a file stream for stderr,
not the newer SDK's `stderr` pipe accessor.


Configuration regressions live in `tests/unit/config.test.ts`,
`tests/unit/input-validation.test.ts` and `tests/unit/elasticsearch-config.test.ts`.
They cover absent/blank settings, exact credential/text preservation, strict typed
boundaries, malformed URLs, zero retries and rejection before provider access.
The packaged suite additionally launches invalid-setting fixtures with network
access blocked, checking nonzero exit, empty stdout, named settings and no value
leakage. Successful startup alone is not evidence of invalid-setting rejection.


Shared result/error tests (`server-result`, `aijobsearch-errors` and
`aijobsearch-handler`) verify SDK schema compatibility, both migrated tool success
and failure envelopes, error privacy, input rejection, retry metadata and
serialization failures. Packaged ASU checks call both actual tools with invalid
arguments and blocked network operations, verifying safe tool-error results.
Provider-specific response schemas and successful live provider operations are
not established by these fixtures.


PostgreSQL `postgresql-config` tests construct real pg objects without connecting;
`postgresql-service` tests use fake clients/clocks for SQL preservation, result
truncation, transaction selection, failures, deadlines and late acquisitions.
Packaged PostgreSQL checks also call both advertised tools, including invalid
input and a guarded connection failure. These do not establish live certificate
validation, database permissions or server-side cancellation timing.


Duffel cancellation fixtures (`duffel-cancellation.test.ts`) exercise pending quote
creation, exact quote/order checks, nullable refunds/expiry, already-confirmed
state, stale/provider failures and uncertain confirmation outcomes without retries.
Packaged Flight checks verify both new tools, safe error envelopes and removal of
the old cancel tool. No booking, cancellation or refund occurs in these checks.

Salesforce bulk-delete fixtures use fake fetch responses for the real service:
ordered arrays, partial failures, all-or-none rollback, malformed outcomes, ID
matching and input limits. The packaged SDK check verifies the bulk tool's MCP
error flag. These tests do not delete live records or exercise authentication.
