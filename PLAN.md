# Implementation plan: MCP Suite reliability and maintenance

## Objective and context

Make the seven retained servers reproducibly buildable, testable, protocol-safe,
and maintainable before adding a model-backed integration.

- Sources: user-approved recommendations and audits in this conversation;
  AGENTS.md, docs/testing.md, docs/server-development.md, scripts/, config/,
  shared/, remaining manifests and tool/service implementations.
- Retained servers: aijobsearch, canvas, clickup, elasticsearch, flight,
  postgresql, salesforce.
- Included in the clean-slate baseline: ten server removals; author metadata set to
  Cory <cory.siebler@phitechsolutions.com>; AGENTS.md and repository map; Rovo guide.
  Preserve these changes. Their presence is not a passing runtime baseline.
- Scope: local code, tests, packaging, release preparation, and accurate docs.
- Non-goals: restore removed servers, change global harness configuration, migrate
  databases, perform live writes, publish packages, push tags, or deploy services.
  The create-mcp-server skill is a separate dotfiles deliverable, not work here.
- Working branch: `codex/clean-slate`. The user authorized consolidating the
  current repository, cleanup, and plan into one root commit on this new branch.
  Original history is retained on main at 2a2881a; nothing is pushed. Verify the
  baseline commit and clean worktree before beginning implementation.
- Mode: standard. No implementation advisors recommended; executor owns changes.
  Native staged reviewer: story-reviewer when required by the shared risk budget.
- Authorization: planning and the single clean-slate baseline commit are authorized.
  Implementation and
  per-story commits remain pending. Dependencies, build/format configuration,
  generated-file deletion, and release-script changes need scoped execution
  authorization under AGENTS.md; plan approval alone grants none of these.
  Existing authentication/authorization edits remain prohibited by repository policy.
- Delivery: one scoped, verified, reviewed, explicitly authorized commit per story.
  Preserve the baseline and any subsequent unrelated changes; do not absorb
  unrelated changes into story commits without authorization.
- Current status: prepared; all stories pending. No implementation tests run during
  planning. Baseline preparation attempted npm run type-check, which could not
  run because tsc is absent; git diff --check passed. No formatter is configured.
  Do not create docs/progress.md or memory.json during planning.

## Verification and execution conventions

Existing commands: npm run type-check; npm run lint; npm run build:shared;
npm run build -- --server=<name>; npm run build -- --server=all;
npm test -- tests/unit/shared-utils.test.ts; git diff --check.
Dependencies are currently absent, lint lacks a tracked configuration, and no
formatter is configured. US-001 establishes the actual runnable check commands;
do not silently download tools via npx or call unavailable checks passed.

Every implementation story requires a meaningful failing regression before its
behavior change, configured formatting/lint, npm run type-check (including test
sources through the tooling established in US-001), and focused offline tests.
Build/package stories also require npm run build -- --server=all. Run the full
suite only after US-001 separates live checks. No UI work is planned; if scope
adds UI, use verify-interface. Documentation-only criteria use link/JSON checks
and git diff --check; required pre-commit typecheck still applies.

Apply this workflow to each story:
- [ ] Verify exact prepared branch, authorization, project policy, and existing work.
- [ ] Reproduce the relevant defect or establish characterization coverage.
- [ ] Implement the bounded story; run its focused and required shared checks.
- [ ] Stage only its candidate and satisfy the shared mode-aware review gate.
- [ ] Address findings, rerun affected checks, and use at most one targeted review.
- [ ] Append execution evidence, update validated memory, and finalize the authorized commit.

## Ordered stories

### US-001 - Establish deterministic local verification
- [ ] Story complete
- Priority: 1
- Depends on: none
- User benefit: make failures observable before refactoring.
- Relevant paths: package.json, lockfiles, tests/, ESLint/Vitest/TypeScript/formatter configuration.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Inventory root and per-server dependencies; after authorized dependency setup, record exact runtime/SDK versions and baseline errors. Avoid wholesale version upgrades.
- [ ] Configure working formatting/lint, typechecking of source and tests, and an explicit offline default test suite; live Duffel tests are opt-in and report genuine skips.
- [ ] Run the shared utility baseline and a fixture-only test; report any pre-existing failures with a bounded remediation owner. No credentials or live services are required.

### US-002 - Make build and package entry points consistent
- [ ] Story complete
- Priority: 2
- Depends on: US-001
- User benefit: run every retained server from its distributed files.
- Relevant paths: scripts/build.js, shared/tsconfig.json, server manifests/tsconfigs, package scripts, packaging tests.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Discover exactly seven valid server packages with filesystem APIs; resolve paths from the repository/script rather than cwd. Reject unknown server arguments before building.
- [ ] Invoke installed compilers with argument arrays and explicit cwd; no shell interpolation or npx download fallback. Build failures retain useful sanitized diagnostics and nonzero status.
- [ ] Choose one documented shared-output/package strategy; emitted JS/declarations/maps stay in build directories and each package includes its shared runtime dependencies. Remove obsolete tracked outputs only within authorized scope.
- [ ] All declared bin/main/start paths match actual output; fix Elasticsearch path/alias inconsistencies. Fixture-backed startup works from an unrelated cwd and package inventory is checked.

### US-003 - Make shared logging protocol-safe
- [ ] Story complete
- Priority: 3
- Depends on: US-001
- User benefit: get diagnostics without corrupting MCP or exposing credentials.
- Relevant paths: shared/utils/logger.ts, retained callers, logger/stdio regression tests.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Every log level writes exclusively to stderr. Startup, tool calls, and error paths produce no diagnostic stdout.
- [ ] Redact known credential fields and connection/authorization data; avoid logging raw SQL, provider bodies, or full request/error objects. Bound message size and preserve useful context.
- [ ] Circular objects, BigInt, Error instances, and serialization failures cannot throw from logging or mask the original operation. Verify redaction with synthetic secrets.

### US-004 - Tighten shared configuration and validation
- [ ] Story complete
- Priority: 4
- Depends on: US-001
- User benefit: receive predictable configuration and input errors.
- Relevant paths: shared/utils/config.ts, shared/utils/validation.ts, affected server constructors/tools, tests.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Required settings reject missing/empty values with field names only; typed booleans, integers, enums, and URLs use explicit bounds and defaults without trimming sensitive data indiscriminately.
- [ ] Replace generic sanitization assumptions with operation-specific runtime validation; preserve exact text when required. Validate URL schemes/destinations and paths only where their contract requires it.
- [ ] Cover malformed values and boundary cases before updating callers. Preserve documented environment names or explicitly document compatibility changes; do not change authentication logic.

### US-005 - Simplify shared types and error contracts
- [ ] Story complete
- Priority: 5
- Depends on: US-003, US-004
- User benefit: get consistent typed failures without duplicated abstractions.
- Relevant paths: shared/types/, shared/middleware/, retained response handlers, tests.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Use discriminated success/failure results and unknown at external boundaries; align MCP descriptions/results with types supported by the selected SDK, without an implicit major upgrade.
- [ ] Normalize provider errors into actionable safe messages and stable categories; preserve relevant retry information without raw private payloads. Verify outputs against schemas.
- [ ] Prove middleware consumers before removal. Remove unused generic error handling under scoped deletion authorization; keep unused auth middleware quarantined if policy forbids its removal until that boundary is resolved.
- [ ] Migrate one shared contract consistently across its callers with error/success characterization tests; no broad server-framework abstraction.

### US-006 - Correct PostgreSQL connection and query safeguards
- [ ] Story complete
- Priority: 6
- Depends on: US-003, US-004
- User benefit: query with verified transport security and bounded execution.
- Relevant paths: servers/postgresql/src/, database service tests.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Remove unconditional disabled TLS verification; document explicit local/non-TLS versus verified TLS and trusted CA configuration. Test options without changing a live connection.
- [ ] Add bounded query execution and predictable cancellation/cleanup. Test transaction rollback/release and read-only behavior with fake database clients; avoid claiming keyword filters are a security boundary.
- [ ] Replace fragile automatic LIMIT rewriting with a documented, tested result/query policy that preserves supported SQL behavior. Document database-role permissions without altering roles or authorization logic.
- [ ] Preserve the two public tool contracts unless a reviewed migration is necessary. No migrations, live writes, or production connection changes.

### US-007 - Repair Duffel cancellation and uncertain outcomes
- [ ] Story complete
- Priority: 7
- Depends on: US-003, US-005
- User benefit: review cancellation terms before a booking is cancelled.
- Relevant paths: servers/flight/src/, offline Duffel fixtures/tests, Flight documentation.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Verify current official Duffel cancellation API and implement separate quote and confirm operations; document migration from the old cancel tool.
- [ ] Return quote/refund details before confirmation and validate the chosen quote identity. Preserve host confirmation requirements; do not rely on annotations as authorization.
- [ ] Mock non-cancellable orders, stale quotes, provider errors, uncertain timeout and successful confirmation. Never blindly retry a cancellation; no real booking/cancellation occurs in tests.

### US-008 - Verify Salesforce bulk-delete reporting
- [ ] Story complete
- Priority: 8
- Depends on: US-005
- User benefit: see partial failures and transaction semantics accurately.
- Relevant paths: servers/salesforce/src/services/salesforce-service.ts, Salesforce tests.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Check the official Composite API response shape and reproduce current misclassification with a fixture before fixing it.
- [ ] Preserve the 200-record limit and allOrNone semantics; report per-record outcomes and overall failure correctly for arrays, partial failure and malformed responses.
- [ ] Use mocks only; no Salesforce deletion or authentication changes. Document schema/output changes if required.

### US-009 - Verify Elasticsearch contracts
- [ ] Story complete
- Priority: 9
- Depends on: US-002, US-005
- User benefit: use search and maintenance tools with predictable results.
- Relevant paths: servers/elasticsearch/src/, server README, fixture tests.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Validate all 18 advertised names against dispatch and schemas; cover representative read, pagination/aggregation, document mutation, and index administration mappings.
- [ ] Check provider errors, empty data and result bounds; accurately annotate mutations. Use fixture clients only, with no cluster creation/deletion.
- [ ] Confirm public MCP error formatting and packaged startup with the selected SDK; keep provider-specific administration outside shared generic code.

### US-010 - Validate Canvas tool inventory and focused exposure
- [ ] Story complete
- Priority: 10
- Depends on: US-002, US-005
- User benefit: avoid loading unnecessary Canvas tools while retaining workflows.
- Relevant paths: servers/canvas/src/tools/, category services, startup/config, tests.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Check all 185 advertised tools for unique names and reachable handlers; derive category inventories from actual registrations.
- [ ] Add optional category selection with backward-compatible default exposure; reject unknown categories and test that omitted categories cannot dispatch hidden tools.
- [ ] Test representative read/write contracts per category using fixtures, including pagination and provider errors; no real student, grading, login or SSO changes.

### US-011 - Verify ClickUp contracts
- [ ] Story complete
- Priority: 11
- Depends on: US-002, US-005
- User benefit: reliably use the retained operations that motivated keeping ClickUp.
- Relevant paths: servers/clickup/src/index.ts, ClickUp tests/documentation.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Cover all 29 tool names and dispatch consistency; fixture-test tasks/comments, hierarchy operations, time entries and goals.
- [ ] Validate pagination, required fields, provider errors and mutation annotations; extract provider mapping only where necessary for isolated tests.
- [ ] Preserve existing tool names and behavior or document an explicit migration. No live task, time-entry, hierarchy or goal mutation.

### US-012 - Verify the ASU job-search integration
- [ ] Story complete
- Priority: 12
- Depends on: US-002, US-005
- User benefit: retain an explicit supported API contract rather than an assumed proof-of-concept endpoint.
- Relevant paths: servers/aijobsearch/src/, README, fixtures/tests.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Identify authoritative endpoint/taxonomy documentation or record the missing provider contract as a blocker to live-readiness. Do not assume the current proof-of-concept default is supported.
- [ ] Fixture-test skills extraction and both job-match input variants, malformed responses, timeout and size bounds; ensure error/log output cannot reveal tokens or submitted personal content.
- [ ] Document endpoint configuration and actual validation limits; no resume or private data is sent to a provider.

### US-013 - Reconcile metadata and inactive configuration
- [ ] Story complete
- Priority: 13
- Depends on: US-002, US-009, US-010, US-011, US-012
- User benefit: find accurate server/setup information from one inventory.
- Relevant paths: config/, scripts discovery, README.md, docs/, tests/fixtures/jira-responses.json.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Use one authoritative server inventory shared by build/release discovery; derive or validate tool counts and required environment variables from explicit source metadata.
- [ ] Remove unused development/production JSON and replace stale servers.json with generated or validated catalog data under scoped deletion authorization; do not introduce an unused configuration loader.
- [ ] Remove the orphan Jira fixture after proving no consumers; active docs describe exactly seven retained servers with accurate executable paths and credentials.
- [ ] Keep author metadata consistent. Resolve missing license documentation only from verified provenance/owner intent; do not invent or relicense historical material.

### US-014 - Unify release preparation and documentation
- [ ] Story complete
- Priority: 14
- Depends on: US-013
- User benefit: prepare one reviewable release candidate with accurate notes.
- Relevant paths: scripts/deploy.js, scripts/publish.js, releases/, CHANGELOG.md, release tests/docs.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Document independent server package versions and namespaced server-vX.Y.Z tags; suite changelog entries distinguish package releases from repository-wide changes.
- [ ] Replace duplicate release flows with one preparation contract that discovers all seven packages, validates semver/arguments, and refuses unsafe branch/staging state. Use argument arrays, not shell interpolation.
- [ ] Keep manifests and lockfiles synchronized; generate a reviewable release plan and one notes source/payload per new release. Update Unreleased with actual changes; retain historical records.
- [ ] No preparation step publishes, commits, tags, pushes, or silently stages unrelated work. Test all external commands with fakes, including failures and invocation from another cwd.

### US-015 - Make release publication explicit and recoverable
- [ ] Story complete
- Priority: 15
- Depends on: US-014
- User benefit: publish only the previously verified candidate with traceable outcomes.
- Relevant paths: release CLI implementation, release tests, release checklist.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Provide a distinct explicit publication action with clean-state/artifact/version preflight and configurable registry/account checks that do not disclose credentials.
- [ ] Define ordering and resumable failure outcomes across commit/tag/package publication; never claim atomicity across Git and npm. Published versions are not rolled back by rewriting history.
- [ ] Test build, verification, registry, commit, tag and push failures with fakes. Default commands cannot publish all packages accidentally.
- [ ] Actual publishing, tagging, committing or pushing remain separately authorized operations and are not performed to complete this story.

### US-016 - Verify all retained server packages end to end offline
- [ ] Story complete
- Priority: 16
- Depends on: US-006, US-007, US-008, US-009, US-010, US-011, US-012, US-015
- User benefit: have a trustworthy release-readiness baseline.
- Relevant paths: tests/, package output, docs/testing.md, README.md, repository map.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Initialize, list tools, call representative success/error fixture operations, and close each of seven actual built/package entry points using a real SDK client.
- [ ] Check protocol-only stdout, required credential failures using fake values, output schemas, resource cleanup and startup outside the source cwd. Mark live validation separately.
- [ ] Run the configured formatter, lint, typecheck, all offline tests and all-server build; document precise commands, supported versions and any unresolved provider limitations.
- [ ] Update AGENTS.md and map only for durable changed contracts. No global install, live mutation, deployment, or unsolicited publication.

## Gated follow-on: Jev integration

Jev implementation is deferred until the baseline is verified and the exact model,
provider/model ID, supported API, account access, costs, limits and data handling
are confirmed from authoritative sources. No time-limited free promotion is assumed.
Then prepare a bounded follow-on story using the installed create-mcp-server skill:
supplied diff/context in, validated structured findings out; no implicit filesystem
reads, code changes or merges. Include request/output limits, timeouts, mocked
provider tests, a real MCP transport smoke test and review-quality rubric. Fury and
Mysterio integration belongs to its own repository and authorization scope.

## Resume and delivery

For authorized execution, load the installed prepare-implementation skill and
read references/story-execution.md and references/story-review.md relative to
that skill's reported base directory. Follow its CodexGoalMarkdown adapter.
If discovery, a reference, or required story-reviewer invocation is unavailable,
stop with the exact blocker; do not invent paths, substitute reviewers or skip gates.

Read this plan, relevant latest docs/progress.md entries, and memory.json if
present, relative to the worktree root. Keep only scope/criteria/dependencies and
completion state here. Append commands/results, actual changes, review history,
permissions, blockers, commits and resumption checkpoints to docs/progress.md;
never rewrite its history. Create it only during authorized execution after branch
and unrelated-work guards pass. Missing memory is normal; use empty version-1
memory in process and create/update it only after passing review, with at most
20 patterns and 20 suppressions. Preserve invalid memory and stop.

Use shared fast/standard/deep risk budgets, default standard; no advisors are
requested and any permitted advisors remain read-only and within the shared cap
of two. Select the lowest numeric priority eligible incomplete story. Recheck the
exact prepared branch before writes, staging and commits. Do not create/switch
branches, push, post externally or infer sensitive-operation grants.

Native review uses story-reviewer, the full shared protocol/JSON schema embedded
in each invocation, and the execution contract's packet preflight. Start a separate
reviewer session per story/attempt; record actual role and session ID. At most one
initial and one targeted same-session review per attempt; self-review is allowed
only by the mode/risk budget. Invalid or final blocked review stops delivery;
continuation alone does not reset review budgets. Resume only after verifying a
material resolution to the blocker and preserving the previous findings/history.

Stage provisional completion only after required checks/review pass. Delivery
requires the explicitly authorized story commit. Restore only the provisional
marker on failed finalization and preserve evidence/checkpoints. A passing syntax
check or exhausted budget never completes a story.

- [ ] Final report records actual commits, verification/review outcomes, delivered scope and gaps.

After all stories are delivered, archival is a separate explicit approval under
references/completed-run-archive.md from the installed skill. Planning and story
commit authorization do not authorize resetting or archiving active state.
