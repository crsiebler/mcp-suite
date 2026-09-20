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
- Scope: local code, tests, npm workspace packaging, Changesets release
  preparation, GitHub Actions workflow definitions, and accurate contributor/release docs.
- Non-goals: restore removed servers, change global harness configuration, migrate
  databases, perform live writes, publish packages, push tags, or deploy services.
  The create-mcp-server skill is a separate dotfiles deliverable, not work here.
- Working branch: `codex/clean-slate`. The user authorized consolidating the
  current repository, cleanup, and plan into one root commit on this new branch.
  Original history is retained on main at 2a2881a; nothing is pushed. Verify the
  baseline commit and clean worktree before beginning implementation.
- Mode: standard. No implementation advisors recommended; executor owns changes.
  Native staged reviewer: story-reviewer when required by the shared risk budget.
- Authorization: the user approved execution of all 16 stories, required local
  dependencies/configuration, planned removals, local CI definitions, and one
  commit per verified story. Preserve the pre-existing package.json ordering
  changes and include the revised plan with the first story. No publication,
  pushes, live service changes, or global configuration are authorized.
  Existing authentication/authorization edits remain prohibited by repository policy.
- Delivery: one scoped, verified, reviewed, explicitly authorized commit per story.
  Preserve the baseline and any subsequent unrelated changes; do not absorb
  unrelated changes into story commits without authorization.
- Current status: US-001 through US-013 verified. US-014 through US-016 pending. Missing upstream notices remain a publication prerequisite.
  Verification and execution evidence are recorded in docs/progress.md.

## Release workflow decision

Use npm workspaces for the seven server packages, Changesets for independent
package versions and changelogs, and GitHub Actions for release PR preparation
and separately gated publication. Keep the root package private. Reuse maintained
tooling; do not implement a custom version calculator or release orchestrator.
A small build wrapper is acceptable only for actual shared compilation ordering.

Contributor Changeset -> reviewed version/changelog PR -> verified package
artifacts -> explicitly authorized npm publication -> package GitHub Releases.
Package changelogs are the source for new release notes; the root changelog records
suite-wide changes and links to package histories. Preserve historical releases
without maintaining duplicate Markdown/JSON release payloads for future versions.

Document the workflow as it is implemented, not only at final verification:
AGENTS.md owns durable agent rules; docs/server-development.md owns contribution
steps; new docs/releasing.md owns release preparation/publication/recovery;
README.md and docs/architecture.md link to these and describe supported commands.

Bootstrap uses the clean-slate root commit as a new history boundary. Existing npm
versions remain authoritative: verify package ownership, published versions and
existing tags before choosing first releases; do not reset versions or reconstruct
old release notes from the squashed commit. The eventual remote release branch and
per-package trusted-publisher setup remain activation prerequisites, not guessed
from the local branch. Pin mutually compatible stable CLI/action versions during
implementation; do not copy development-branch examples without checking support.

Research sources: [npm lifecycle](https://docs.npmjs.com/cli/v11/using-npm/scripts/),
[npm publication](https://docs.npmjs.com/cli/v11/commands/npm-publish/),
[Changesets workflow](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md),
[Changesets Action](https://github.com/changesets/action), and
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

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
Build/package stories also require the all-server build (currently npm run build
-- --server=all; US-002 establishes and documents its workspace replacement). Run the full
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

- [x] Story complete
- Priority: 1
- Depends on: none
- User benefit: make failures observable before refactoring.
- Relevant paths: package.json, lockfiles, tests/, ESLint/Vitest/TypeScript/formatter configuration.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Inventory root and per-server dependencies; after authorized dependency setup, record exact runtime/SDK versions and baseline errors. Avoid wholesale version upgrades.
- [ ] Configure working formatting/lint, typechecking of source and tests, and an explicit offline default test suite; live Duffel tests are opt-in and report genuine skips.
- [ ] Run the shared utility baseline and a fixture-only test; report any pre-existing failures with a bounded remediation owner. No credentials or live services are required.

### US-002 - Make build and package entry points consistent

- [x] Story complete
- Priority: 2
- Depends on: US-001
- User benefit: run every retained server from its distributed files.
- Relevant paths: root/server manifests and lockfiles, scripts/build.js, shared/tsconfig.json, server tsconfigs, packaging tests, README.md, docs/architecture.md, docs/server-development.md.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Configure npm workspaces for exactly seven server packages and mark the root private. Consolidate installation around the root lockfile; remove redundant server locks only within authorized scope. Verify a frozen install and package discovery without publishing.
- [ ] Use workspace metadata for build/release package discovery; explicitly order shared compilation before server builds. Keep a wrapper only where needed, resolve paths independent of cwd, and reject unknown package arguments before building.
- [ ] Invoke installed compilers with argument arrays and explicit cwd; no shell interpolation or npx download fallback. Build failures retain useful sanitized diagnostics and nonzero status.
- [ ] Choose one documented shared-output/package strategy; emitted JS/declarations/maps stay in build directories and each package includes its shared runtime dependencies. Remove obsolete tracked outputs only within authorized scope.
- [ ] All declared bin/main/start paths match actual output; fix Elasticsearch path/alias inconsistencies. Fixture-backed startup works from an unrelated cwd and package inventory is checked.
- [ ] Define a consistent build/pack lifecycle: npm pack must include current built files, through a tested prepack hook or an explicit prerequisite. Avoid duplicate builds and rename the root publish orchestration command to avoid npm lifecycle collisions.
- [ ] Update README.md, docs/architecture.md and docs/server-development.md with verified workspace install/build/pack commands and shared-output behavior. Inspect files allowlists and test the actual tarball; dry-run commands are not assumed free of lifecycle side effects.

### US-003 - Make shared logging protocol-safe

- [x] Story complete
- Priority: 3
- Depends on: US-001
- User benefit: get diagnostics without corrupting MCP or exposing credentials.
- Relevant paths: shared/utils/logger.ts, retained callers, logger/stdio regression tests.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Every log level writes exclusively to stderr. Startup, tool calls, and error paths produce no diagnostic stdout.
- [ ] Redact known credential fields and connection/authorization data; avoid logging raw SQL, provider bodies, or full request/error objects. Bound message size and preserve useful context.
- [ ] Circular objects, BigInt, Error instances, and serialization failures cannot throw from logging or mask the original operation. Verify redaction with synthetic secrets.

### US-004 - Tighten shared configuration and validation

- [x] Story complete
- Priority: 4
- Depends on: US-001
- User benefit: receive predictable configuration and input errors.
- Relevant paths: shared/utils/config.ts, shared/utils/validation.ts, affected server constructors/tools, tests.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Required settings reject missing/empty values with field names only; typed booleans, integers, enums, and URLs use explicit bounds and defaults without trimming sensitive data indiscriminately.
- [ ] Replace generic sanitization assumptions with operation-specific runtime validation; preserve exact text when required. Validate URL schemes/destinations and paths only where their contract requires it.
- [ ] Cover malformed values and boundary cases before updating callers. Preserve documented environment names or explicitly document compatibility changes; do not change authentication logic.

### US-005 - Simplify shared types and error contracts

- [x] Story complete
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

- [x] Story complete
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

- [x] Story complete
- Priority: 7
- Depends on: US-003, US-005
- User benefit: review cancellation terms before a booking is cancelled.
- Relevant paths: servers/flight/src/, offline Duffel fixtures/tests, Flight documentation.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Verify current official Duffel cancellation API and implement separate quote and confirm operations; document migration from the old cancel tool.
- [ ] Return quote/refund details before confirmation and validate the chosen quote identity. Preserve host confirmation requirements; do not rely on annotations as authorization.
- [ ] Mock non-cancellable orders, stale quotes, provider errors, uncertain timeout and successful confirmation. Never blindly retry a cancellation; no real booking/cancellation occurs in tests.

### US-008 - Verify Salesforce bulk-delete reporting

- [x] Story complete
- Priority: 8
- Depends on: US-005
- User benefit: see partial failures and transaction semantics accurately.
- Relevant paths: servers/salesforce/src/services/salesforce-service.ts, Salesforce tests.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Check the official Composite API response shape and reproduce current misclassification with a fixture before fixing it.
- [ ] Preserve the 200-record limit and allOrNone semantics; report per-record outcomes and overall failure correctly for arrays, partial failure and malformed responses.
- [ ] Use mocks only; no Salesforce deletion or authentication changes. Document schema/output changes if required.

### US-009 - Verify Elasticsearch contracts

- [x] Story complete
- Priority: 9
- Depends on: US-002, US-005
- User benefit: use search and maintenance tools with predictable results.
- Relevant paths: servers/elasticsearch/src/, server README, fixture tests.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Validate all 18 advertised names against dispatch and schemas; cover representative read, pagination/aggregation, document mutation, and index administration mappings.
- [ ] Check provider errors, empty data and result bounds; accurately annotate mutations. Use fixture clients only, with no cluster creation/deletion.
- [ ] Confirm public MCP error formatting and packaged startup with the selected SDK; keep provider-specific administration outside shared generic code.

### US-010 - Validate Canvas tool inventory and focused exposure

- [x] Story complete
- Priority: 10
- Depends on: US-002, US-005
- User benefit: avoid loading unnecessary Canvas tools while retaining workflows.
- Relevant paths: servers/canvas/src/tools/, category services, startup/config, tests.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Check all 185 advertised tools for unique names and reachable handlers; derive category inventories from actual registrations.
- [ ] Add optional category selection with backward-compatible default exposure; reject unknown categories and test that omitted categories cannot dispatch hidden tools.
- [ ] Test representative read/write contracts per category using fixtures, including pagination and provider errors; no real student, grading, login or SSO changes.

### US-011 - Verify ClickUp contracts

- [x] Story complete
- Priority: 11
- Depends on: US-002, US-005
- User benefit: reliably use the retained operations that motivated keeping ClickUp.
- Relevant paths: servers/clickup/src/index.ts, ClickUp tests/documentation.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Cover all 29 tool names and dispatch consistency; fixture-test tasks/comments, hierarchy operations, time entries and goals.
- [ ] Validate pagination, required fields, provider errors and mutation annotations; extract provider mapping only where necessary for isolated tests.
- [ ] Preserve existing tool names and behavior or document an explicit migration. No live task, time-entry, hierarchy or goal mutation.

### US-012 - Verify the ASU job-search integration

- [x] Story complete
- Priority: 12
- Depends on: US-002, US-005
- User benefit: retain an explicit supported API contract rather than an assumed proof-of-concept endpoint.
- Relevant paths: servers/aijobsearch/src/, README, fixtures/tests.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Identify authoritative endpoint/taxonomy documentation or record the missing provider contract as a blocker to live-readiness. Do not assume the current proof-of-concept default is supported.
- [ ] Fixture-test skills extraction and both job-match input variants, malformed responses, timeout and size bounds; ensure error/log output cannot reveal tokens or submitted personal content.
- [ ] Document endpoint configuration and actual validation limits; no resume or private data is sent to a provider.

### US-013 - Reconcile metadata and inactive configuration

- [x] Story complete
- Priority: 13
- Depends on: US-002, US-009, US-010, US-011, US-012
- User benefit: find accurate server/setup information from one inventory.
- Relevant paths: config/, workspace discovery, README.md, docs/overview.md, docs/architecture.md, docs/server-development.md, tests/fixtures/jira-responses.json.
- Verification: common formatting/lint/typecheck gates plus the focused checks below.
- [ ] Use npm workspace metadata as the authoritative package inventory shared by build/release discovery; derive or validate tool counts and required environment variables from explicit source metadata, without a second handwritten package list.
- [ ] Remove unused development/production JSON and replace stale servers.json with generated or validated catalog data under scoped deletion authorization; do not introduce an unused configuration loader.
- [ ] Remove the orphan Jira fixture after proving no consumers; active docs describe exactly seven retained servers with accurate executable paths and credentials.
- [ ] Keep author metadata consistent. Resolve missing license documentation only from verified provenance/owner intent; do not invent or relicense historical material.

### US-014 - Adopt Changesets and document contribution/release preparation

- [ ] Story complete
- Priority: 14
- Depends on: US-013
- User benefit: describe changes once and review accurate versions and release notes.
- Relevant paths: package.json, root lockfile, new .changeset/ configuration, package CHANGELOG.md files, root CHANGELOG.md, releases/, scripts/deploy.js, scripts/publish.js, AGENTS.md, docs/server-development.md, new docs/releasing.md, README.md.
- Verification: common formatting/lint/typecheck gates, offline Changesets fixture checks, documentation command/link checks.
- [ ] Add a compatible stable Changesets CLI and configure independent public server packages, a private root, explicit base-branch selection and the tool's documented package tag convention. Record the selected convention; do not retain custom server-v tags merely to match obsolete scripts.
- [ ] Provide preparation commands using the installed CLI; changeset version updates package manifests/changelogs and the documented lockfile synchronization step. Preparation cannot publish, commit, push or stage unrelated work. Retire the duplicated custom version/publish flows within authorized deletion scope; publication wiring follows in US-015.
- [ ] Test fixtures for one package, several packages, combined bump levels, breaking changes, internal dependency effects and a no-release change. Account explicitly for shared code copied/bundled into packages: affected consumers need Changesets even if no declared workspace dependency lets the tool infer them. Check unchanged package versions and synchronized locks.
- [ ] Use each package changelog as the new release-note source. Reconcile actual suite-wide Unreleased entries, retain historical release records and label their old-history context; stop generating duplicate new Markdown/JSON payloads. Do not invent historical release events or publish a baseline as a test.
- [ ] Add contributor guidance and AGENTS.md rules covering when a Changeset is required, affected-package selection, patch/minor/major decisions, breaking-change migration notes, useful user-facing summaries, examples and justified no-release changes. Conventional Commit requirements remain in place but do not replace Changesets.
- [ ] Create docs/releasing.md with version-PR preparation/review, changelog editing, lockfile checks, exact build/pack verification commands and the initial-release checklist: inspect published names/versions/ownership, choose supported versions and establish the new history boundary. Distinguish executable local preparation from publication configuration pending US-015; README links to both guides.

### US-015 - Define gated CI publication and document recovery

- [ ] Story complete
- Priority: 15
- Depends on: US-014
- User benefit: release verified packages through a documented and recoverable process.
- Relevant paths: new .github/workflows/ release/verification definitions, package release commands, workflow fixtures, docs/releasing.md, docs/testing.md, AGENTS.md, README.md, docs/architecture.md.
- Verification: common formatting/lint/typecheck gates, workflow schema/lint checks using authorized tooling, fixture-driven command/condition tests; no live workflow dispatch or external writes.
- [ ] Use a compatible stable Changesets Action to prepare/update a version-and-changelog PR. CI verifies the release candidate before publication; document branch selection, permissions, concurrency and the approval boundary. Do not enable an unguarded publish-on-every-push path or infer that this local branch is the remote release branch.
- [ ] Define a separate explicitly gated publication job using npm trusted publishing on supported hosted runners, with supported Node/npm versions and per-package OIDC configuration documented. Prefer maintained Changesets/npm commands, not a replacement custom release CLI. Registry setup and workflow activation are separate authorized operations; missing setup fails clearly without a silent token fallback.
- [ ] Verify packaging and fixture MCP startup against the release candidate and ensure published contents match those verified; no version mutation or unchecked rebuild after verification. Publish only release-plan packages, exclude the root, and define stable/prerelease dist-tags. No npm/GitHub tokens or live services are required for local validation.
- [ ] Generate package GitHub Releases from the corresponding changelog only after confirmed publication, using the selected tag convention and verified source commit. Distinguish prepared, published and announced states; document provenance separately from user-facing release notes.
- [ ] Cover failed checks, denied/missing approval, registry rejection, one-package success followed by failure, and tag/GitHub Release failure after npm success with fakes. Document reconciliation/retry using actual published versions and source/artifact identity; do not republish an existing name/version, assume cross-service atomicity, or rewrite shared history.
- [ ] Complete docs/releasing.md with trusted-publisher prerequisites, first-release activation, reviewer checklist, publication approval, prereleases and partial-failure recovery. Update AGENTS.md, README.md, docs/testing.md and docs/architecture.md with verified commands and ownership; remove active instructions to use retired scripts while preserving historical records.
- [ ] Validate the documented contribution-to-release sequence with local fixtures and command/schema checks. Report CI syntax/fixture verification separately from unperformed hosted/OIDC integration; actual publishing, tagging, release PRs, GitHub Releases, pushes and registry changes are not performed to complete this story.

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
- [ ] Verify README.md, AGENTS.md, contribution/release guides and the map consistently describe the implemented workspace/Changesets/CI workflow, including commands, package changelogs and release approval/recovery. Documentation must already ship with US-002/014/015; this is the final consistency check. No global install, live mutation, deployment, or unsolicited publication.

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
