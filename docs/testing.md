# Testing and verification

Install locked root dependencies with `npm ci`. Run commands from the repository
root. The root lockfile installs all six workspaces and their declared SDK versions.
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
client to initialize/list/call/close each server with synthetic environment values
and a process network guard. It cleans up its own fixtures under dist/test-artifacts. No provider
requests are permitted. Representative success/error calls are not exhaustive
provider-contract coverage.

Keep provider-backed tests out of the default test configuration. Add ordinary
fixture integration tests under tests/ with `.test.ts` names. If another live
suite is added, update both Vitest configurations and its explicit opt-in guard.

Documentation validation uses link/path checks and `git diff --check`. Release
preparation mutates versions/changelogs; run it only in an authorized checkout or
disposable fixture. Publication/tagging commands are never verification commands.

## Verified baseline

US-001 uses Node v26.7.0, npm 11.19.0, TypeScript 5.9.3, Vitest 1.6.1,
ESLint 8.57.1 and Prettier 3.9.8. The root SDK is 0.5.0; server manifests still
request 0.5.x, 0.6.x and 1.x. This records the observed environment, not a claim
of runtime support across all declared versions. See the [archived progress log](../archive/2026-09-20-mcp-suite-reliability/docs/progress.md) for actual
check results and the limitations of this initial verification story.

US-002 additionally verifies the frozen workspace install with engine-strict on
Node 22.14.0/npm 10.9.2, plus all seven builds, typecheck, lint and all 19 offline
tests. Node 22.14.0 is now the declared minimum for the root and all six
packages. That initial fixture validated all packages together using the locked
graph. The US-016 candidate now installs each tarball independently with
`npm ci --omit=dev --offline --ignore-scripts`, followed by `npm ls --omit=dev --all`.
Each install has exactly one root package dependency; tests assert development
tools and sibling servers are absent. Test-only CommonJS/ES module resolution
guards reject fallback to dependencies in the ancestor repository. These guards
are fixture checks, not a security sandbox for untrusted code.

## Diagnostic safety

`npm test -- tests/unit/logger.test.ts tests/unit/logging-callers.test.ts` checks
stderr routing, filtering, synthetic-secret redaction, bounded output, hostile
serialization and provider call-site privacy. Service tests replace only network
or database boundaries; no live requests or database changes occur.

Packaging checks run all six installed tarballs with `LOG_LEVEL=debug`, capture
stderr to fixture-local files, and fail on SDK protocol parsing errors during
initialization, discovery and representative success/error calls. A test adapter
for the pinned SDK also captures raw stdout, validates all newline-delimited JSON-RPC
frames (including trailing output), and waits for the child close event. They preserve the current
Salesforce failure envelope pending response normalization. This proves those
paths are protocol-safe, not every provider-backed operation; full tool coverage
remains separate. The root SDK 0.5 transport accepts a file stream for stderr,
not the newer SDK's `stderr` pipe accessor.

Configuration regressions live in `tests/unit/config.test.ts`,
`tests/unit/elasticsearch-config.test.ts`.
They cover absent/blank settings, exact credential/text preservation, strict typed
boundaries, malformed URLs, zero retries and rejection before provider access.
The packaged suite additionally launches invalid-setting fixtures with network
access blocked, checking nonzero exit, empty stdout, named settings and no value
leakage. Successful startup alone is not evidence of invalid-setting rejection.

Shared result/error tests (`server-result`) verify SDK schema compatibility,
success/failure serialization, safe error classification and retry metadata.
Provider-specific fixtures verify retained handlers; no removed server is required
by shared utility tests.

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

Elasticsearch fixtures cover all 18 dispatch names, advertised bounds/annotations,
provider request mappings, empty results, partial bulk/query outcomes and actual
Elastic error classes. Packaged SDK tests exercise every tool's invalid-input or
guarded read failure. No cluster is created or mutated. These are local contract
checks, not live provider/permission or exhaustive response-schema validation.

Canvas tests cover category selection/hidden dispatch, all185actual handler/service
routes with synthetic inputs, and explicit read/write/error fixtures per category.
The inventory smoke test does not prove every argument's provider semantics.
`canvas-pagination.test.ts` exercises real course service/registry pagination with
an Axios adapter; no live student, grading, login or SSO operations occur.
Packaged checks cover default/selected exposure and unknown-category startup.

ClickUp fixtures cover all 29 names, actual Axios request mappings and provider
error paths. Boundary cases cover required arguments, numeric payload encoding,
page zero, comment cursor pairs, Workspace filtering/member projection, mutation
hints and unknown timeout outcomes without retries. Packaged checks exercise all
29 invalid-input/guarded-read paths through the actual SDK. No task, hierarchy,
time entry or goal is changed remotely; live account capabilities remain unverified.

Catalog validation uses `npm run catalog:check` (all-server build followed by a
read-only inventory comparison). Unit fixtures check metadata/path constraints;
packaged tests compare all discovered tool names to the generated catalog and
verify each declared required environment variable prevents startup when absent.
The source checker recognizes literal environment readers, not arbitrary data flow;
conditional credential semantics remain explicit metadata/docs and existing runtime logic.

## Changesets fixtures

`npm test -- tests/release/changesets.test.ts tests/unit/release-discovery.test.ts`
uses the actual pinned CLI in disposable project-local Git repositories, with npm
offline and package lifecycle hooks disabled. It checks independent/combined/major
bumps, internal dependency updates, no-release changes, explicit shared consumers,
lock synchronization and preservation of Git HEAD/index/tags. No registry writes
or hosted workflows run. Read [releasing](releasing.md) before version preparation.

## Release workflow verification

`npm test -- tests/release` additionally exercises artifact receipts, membership,
manifests, tags and hashes; actual CLI packing with prepack disabled; actual CLI
publication against a fake npm executable; and parsed workflow contracts plus the
actual inline activation/announcement scripts with fake GitHub responses. Failure
cases include missing reviewers/setup, failed candidate checks, stale registry
plans, registry rejection/partial success, missing or wrong-target tags, and
announcement failure. Git tags exist only in disposable fixture repositories.
These tests never contact npm or GitHub to write state and cannot prove hosted
environment approval, OIDC exchange or registry permissions.

The `artifact-smoke` fixture supplies an actual PostgreSQL tarball to a checkout
without source/build files, then runs the real SDK checks through the release
artifact mode. `MCP_RELEASE_PACK_DIR=<absolute-directory> npm test --
tests/packaging/packages.test.ts` validates and installs the selected tarballs;
it skips source-only catalog validation and absent-server cases. CI runs the full
source suite/catalog first. The ordinary packaging invocation still builds and
tests all six packages. Both modes now use independent production-only installs
and module-resolution guards rather than relying on a combined six-server graph.

CI uses Node 24 on GitHub-hosted Linux; publication checks npm >=11.5.1. The lock
uses public npm tarball URLs with unchanged pinned versions and integrity hashes,
so a hosted install does not require the former private mirror. A successful local
offline cached install is not evidence of a fresh hosted network install.

Workflow syntax/expressions were checked with project-local Actionlint 1.7.12
against both `.github/workflows/*.yml` files. Its release binary was verified
against the upstream asset SHA256; no global installation is required. Parsed
workflow tests complement that check and do not replace hosted integration.

## Packaged success fixtures

`npm test -- tests/packaging/packages.test.ts tests/release/artifact-smoke.test.ts
tests/unit/package-isolation.test.ts tests/unit/packaged-transport.test.ts` exercises
the six independently installed entry points. Success cases cover Canvas courses,
ClickUp teams, Duffel airlines, Elasticsearch search, PostgreSQL read-only query
and Salesforce SOQL. Test-owned Axios adapters, Elastic transport, pg clients and
fetch responses replace provider I/O inside each installation; schemas, dispatch,
service mapping, serialization and SDK traffic remain real. PostgreSQL additionally
records completed BEGIN/query/COMMIT and client release. Error cases retain the
network guard. Its socket refusal emits an asynchronous error, matching Node's
connection-failure contract so pg can discard the failed client and drain its pool.

All paths await child exit. This checks local process/resource cleanup, not remote
query cancellation timing or live TLS, authentication, permissions, quotas or API
compatibility. Release artifact mode runs the same contracts without rebuilding;
the subset fixture verifies PostgreSQL from an existing tarball in a checkout
without server sources. `.mjs` fixture guards also require an explicit ESLint check:
`node_modules/.bin/eslint tests/fixtures/package-isolation.mjs
tests/fixtures/package-provider-responses.mjs`.

## Jev evaluation and lifecycle fixtures

`npm test -- tests/unit/jev.test.ts tests/unit/jev-failures.test.ts` calls the real
pinned evaluation/Gateway SDK with fake fetch responses. It covers mixed questions,
exact JSON preservation, byte/depth/identifier bounds, fractional scores, declared
rounding, metadata validation, HTTP/network failures, warning suppression, streaming
limits, deadlines, overload and slot release. No live model is called.

Packaged Jev additionally uses its independently installed SDK 1.30 client for
cancellation and output-schema validation. The root SDK 0.5 client sends an obsolete
bare `cancelled` notification; it remains useful for legacy text-result checks,
but cannot prove current protocol cancellation. The native client initializes,
lists and calls the real package, with only provider fetch replaced. Cancellation
must reach fetch within one second despite a 120-second server deadline; a follow-up
call must succeed. EOF and SIGTERM must abort fetch and naturally exit zero within
three seconds before client close can terminate the child. Warning, unauthorized
and oversized-body cases assert safe results and captured stdout/stderr privacy.
Provider event files contain only synthetic started/aborted booleans. These checks
do not establish remote billing cancellation, live account access, model accuracy,
privacy routing enforcement or exhaustive upstream API compatibility.
