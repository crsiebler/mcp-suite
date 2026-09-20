# Implementation plan: Jev evaluation MCP server

## Objective and context

Expose TypeSafe AI's Jev through a local MCP server in this repository, using
Vercel AI Gateway. A client supplies state and typed questions; the server returns
validated decisions and probabilities. It does not generate code or explanations.

- Sources: the user's Jev/Vercel MCP request and Fury/Mysterio use cases; current
  AGENTS.md, package.json/lock, docs/server-development.md, docs/testing.md,
  workspace/catalog scripts, and packaged SDK fixtures; official sources below.
- Scope: one TypeScript stdio workspace, one evaluation tool, bounded Gateway
  adapter, offline tests, examples/evaluation fixtures, package metadata and docs.
- Non-goals: chat-provider configuration, direct TypeSafe fallback, hosted HTTP
  transport, background agents, implicit repository/file/URL reads, code generation,
  Git operations by tools, autonomous approval/merge, avengers-initiative edits,
  dotfiles/global installation, credentials provisioning, publishing or deployment.
- Working branch: existing `codex/clean-slate`, currently at `aaf157e`. Execution
  must recheck this exact non-main branch and preserve unrelated work; no branch
  creation/switching is part of this plan. Main now shares its baseline history.
- Mode: standard. No implementation advisors recommended; executor owns changes.
  Native staged reviewer: `story-reviewer` for test-sensitive stories.
- Authorization: user approved plan execution, scoped dependencies/configuration,
  minimal outbound Gateway API-key wiring and passing-story commits. Preserve
  existing authentication and host approval policies. No live calls or credentials
  provisioning are authorized; the key is not established in the environment.
- Delivery: one authorized commit per verified/reviewed story; no implicit push.
- Existing work: author-name updates and completed-run archival were separately
  authorized and committed before Jev execution; preserve the archive.
- Current status: execution in progress; live model verification remains deferred.

## Verified research and remaining decisions

Research date: 2026-09-20, using Exa official-page fetches and Context7.

- [Vercel evaluation documentation](https://vercel.com/docs/ai-gateway/modalities/evaluation)
  confirms `typesafe-ai/jev` via `experimental_evaluate`, with boolean, choice and
  score questions. This implementation uses the AI SDK evaluation API, not Chat Completions,
  Anthropic Messages or Cohere endpoints. The separate TypeSafe-compatible API
  is documented in docs/jev-design.md.
- [Vercel launch note](https://vercel.com/changelog/typesafe-ai-jev-now-available-on-ai-gateway)
  identifies AI SDK 7.0.105 as the first supported release. Pin a verified compatible
  published version and Gateway provider during US-001/002, rather than `latest`.
- [AI SDK reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/evaluate)
  documents shared JSON state, named answers, optional usage/rounding/metadata,
  cancellation and default two retries. Explicitly set retries to zero. Use an
  explicit Gateway evaluation-model instance, avoiding ambient default-provider
  resolution and differences between documentation examples.
- [Gateway provider](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway)
  supports explicit API-key and fetch configuration. Use the published SDK to own
  the endpoint/protocol; do not guess a REST evaluation route.
- [Gateway authentication](https://vercel.com/docs/ai-gateway/authentication-and-byok/authentication)
  supports team API keys in local processes. Require `AI_GATEWAY_API_KEY`; a Vercel
  hosting account alone does not prove model access or available credits. No Vercel
  CLI, Next.js application, hosting project, Docker, or separate TypeSafe key is
  required by this local-server design. No OIDC/login/token-refresh implementation.
- [Vercel Jev guide](https://vercel.com/kb/guide/typesafe-jev-and-ai-sdk)
  distinguishes boolean probability from choice/score confidence. Score is the
  probability-weighted zero-based rubric index, not an integer category. Questions
  share one state; a JSON array is not a batch of unrelated requests.
- [TypeSafe model documentation](https://docs.typesafe.ai/models) describes direct
  model IDs and context/rate limits. Those direct-service IDs/quotas must not be
  substituted for Gateway's model ID or account limits.
- [Gateway model page](https://vercel.com/ai-gateway/models/jev) and guide currently
  list $0.042 per million input tokens, but context fields differ between pages.
  Do not hard-code pricing, promise free calls, or treat byte limits as token limits.
  Recheck account price/access before any separately approved live evaluation.
- Targeted official-source searches did not establish a vendor-maintained Jev MCP
  implementation. This is a custom MCP adapter using official provider SDKs, not
  a claim that none exists. Recheck this narrow question in US-001 before coding.
- Verify exact SDK package exports, engines, Zod compatibility, retention options
  and evaluation-model fixtures against pinned releases. Root MCP SDK is 0.5.0;
  Flight already locks 1.30.0. Prefer that verified 1.x server line if suitable,
  without upgrading the six existing servers or assuming current-main SDK APIs.

## Proposed public contract

Workspace: `servers/jev`; package: `@crsiebler/mcp-jev-server`; executable:
`mcp-jev`; author: `Cory Siebler <cory.siebler@phitechsolutions.com>`.
Follow the existing emitted layout: `dist/servers/jev/src/index.js`, package-local
compiled shared modules, workspace prepack, root lock and `mcpSuite` metadata.
Choose initial package version through the release workflow; do not publish it.

| Tool           | Input                                                              | Output                                                                                                   | Effects                                                                     |
| -------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `jev_evaluate` | `state` (string/JSON object/array), nonempty named `questions` map | Typed `answers`, requested/reported model IDs, optional usage, optional per-question confidence/rounding | Sends supplied data to Gateway; may incur charges; no local/domain mutation |

Each question is a discriminated boolean/choice/score shape with instructions.
Boolean criteria are optional true/false descriptions; choice criteria map option
IDs to descriptions; score criteria are an ordered rubric. Preserve supplied text
and IDs. Do not accept model overrides, destinations, arbitrary headers, file paths,
URLs to fetch, credentials, or provider options in tool arguments.

Return an SDK-valid `structuredContent` object plus matching JSON text for older
clients where supported by the selected MCP version. Advertise a real output
schema. Preserve question/option identities; reject missing/extra answers, wrong
types, out-of-range/nonfinite probabilities or scores, and incompatible probability
keys. Respect verified provider rounding when validating distributions; do not
renormalize or invent probabilities/confidence/usage. Omit unavailable metadata.
Do not forward raw provider response bodies, headers, warnings or private text.

Proposed local limits (application policy, not advertised provider capacity):

- State: 64 KiB UTF-8 JSON representation, depth at most 16; reject non-JSON data.
- Questions: 1–16; IDs 1–64 safe identifier characters; reject prototype-sensitive
  keys. Instructions up to 4 KiB each, criterion descriptions up to 2 KiB each.
- Choice: 2–32 options (deliberately narrower than provider support); score: 2–10
  rubric levels. Combined serialized request at most 128 KiB.
- Evaluation timeout: 30 seconds by default; `JEV_TIMEOUT_MS` integer 100–120000.
  At most two in-flight requests; reject excess immediately, with no hidden queue.
- Provider response body at most 1 MiB using a bounded SDK fetch boundary; public
  result at most 128 KiB. Oversize results fail explicitly, never silently truncate
  distributions. No automatic retries or fallback models/providers.
- Fixed Gateway model `typesafe-ai/jev`; required nonblank `AI_GATEWAY_API_KEY` and
  optional `LOG_LEVEL`. No `.env` loading or credential values in diagnostics.
- Request supported ZDR/no-training controls using verified SDK options; fail rather
  than silently relaxing required routing controls. Document Gateway observability
  separately: routing flags do not prove private payloads are absent from team logs.
- Tool annotations: read-only domain behavior, not destructive, open-world, not
  guaranteed idempotent (probabilistic results and billed calls). They never grant
  approval or replace client policy. No resources/prompts are needed initially.

Fury examples select among caller-supplied next steps, including `ask_user` and
`stop`. Mysterio examples score supplied review evidence/findings and choose among
supplied merge candidates, including `manual_review`/`none`. Jev does not discover
arbitrary textual findings or write a merge resolution. Thresholds are caller-owned,
explicitly illustrative until calibrated; low/absent confidence routes to review.

## Verification commands and shared story requirements

Existing commands: `npm run format -- <changed-files>`, `npm run format:check --
<changed-files>`, `npm run lint`, `npm run type-check`, `npm test -- <focused-files>`,
`npm test`, `npm run build -- --server=all`, `npm run catalog:generate`,
`npm run catalog:check`, `git diff --check`. Explicitly lint changed `.mjs` fixtures
with the installed ESLint because the root lint command omits that extension.
Catalog commands build all workspaces. Tests are offline by default.

Every story requires configured formatting, lint, typecheck and applicable focused
checks before review/commit. Behavior changes require meaningful failing tests;
docs-only stories use source/link validation. Package/dependency changes require
all-server build and frozen-install/minimum-engine checks. Final full offline suite
must preserve the six existing servers. Do not use live calls as ordinary checks.
No UI is planned; if UI is introduced, stop for scope revision and verify-interface.

## Ordered stories

### US-001 - Verify and freeze the evaluation contract

- [x] Story complete
- Priority: 1
- Depends on: none
- User benefit: implementation uses the actual evaluation API and supported releases.
- Relevant paths: proposed `docs/jev-design.md`; existing manifests/lock and official docs.
- [x] Recheck vendor MCP availability against required Gateway evaluation operations;
      document reuse comparison without replacing the explicitly requested custom scope.
- [x] Verify published AI SDK/Gateway/MCP versions, exports/engine/peer compatibility,
      boolean/choice/score schemas, confidence/rounding, warning handling and retention
      settings; record exact sources and selected pins. Resolve unavailable evaluation
      exports before coding; do not fall back to chat generation or an invented endpoint.
- [x] Finalize the contract/limits above, safe error categories, usage fields and
      cancellation semantics; document uncertain model/account/context/price limits.
- [x] Resolve scoped outbound-key wiring authorization and pre-existing file overlap
      before later implementation. No credential access or paid probe needed here.
- [x] Run documentation validation, configured formatting and `npm run type-check`.

### US-002 - Deliver one packaged evaluation tool through Gateway

- [x] Story complete
- Priority: 2
- Depends on: US-001
- User benefit: any local MCP client can evaluate supplied state with Jev.
- Relevant paths: `servers/jev/{package.json,tsconfig.json,src/,README.md}`,
  root lock, catalog output, shared packaging/discovery fixtures and Jev tests.
- [x] Add the independently versioned workspace with pinned compatible dependencies,
      declared engines, main/bin/prepack/files and metadata. Keep existing server SDKs
      unchanged; use the root install/build system and literal environment readers.
- [x] Implement focused config, schemas, provider adapter, handler and stdio entry
      modules. Wire the official SDK evaluation model explicitly; implement all three
      question types, mixed questions/shared state and validated result mapping.
- [x] Enforce the proposed input/output limits and baseline timeout/concurrency/
      retry policy immediately; discovery is offline and never sends an evaluation.
- [x] Add red-to-green runtime-schema, real SDK mocked-provider and real packaged
      initialize/list/success/error/close fixtures. Replace only provider I/O, never the
      production handler, and include native structured output plus legacy text checks.
- [x] Update six-package assertions to seven deliberately, extend success/error
      provider fixtures and metadata checks; no skipping Jev or weakening existing tests.
- [x] Verify isolated production install/ancestor dependency rejection, real prepack,
      required-key failure, correct executable/shared output and unrelated cwd startup.
- [x] Run focused Jev/packaging/discovery tests, formatter/lint/typecheck, all-server
      build/catalog and frozen install on the declared minimum engine. If the selected
      SDK needs a higher runtime, make that explicit before changing existing support.

### US-003 - Prove failure, cancellation and privacy boundaries

- [x] Story complete
- Priority: 3
- Depends on: US-002
- User benefit: malformed data, unavailable providers or cancellation cannot produce
  misleading decisions, leaked payloads or hanging processes.
- Relevant paths: Jev adapter/handler/lifecycle and focused unit/SDK/packaging tests.
- [x] Reproduce and cover 401/403, missing model, 429, 5xx, timeout, network failure,
      malformed/oversize responses, missing/extra answers, bad distributions, fractional
      score semantics, absent confidence/usage and documented rounding boundaries.
- [x] Bound response streaming even without Content-Length; abort and clean up on
      overflow. Bound total call time and ensure concurrency slots release on all paths.
- [x] Propagate MCP cancellation, EOF and shutdown to in-flight provider requests;
      prove child exit, cleared timers and no new work after shutdown with SDK fixtures.
- [x] Set SDK retries to zero explicitly; no retry after timeout/disconnect and no
      automatic provider/model fallback. Expose safe retry hints only when trustworthy.
- [x] Capture stdout/stderr during success and failure; no keys, supplied state,
      instructions, raw provider warnings/headers/bodies or private errors escape.
      Input validation fails before I/O. Preserve SDK-supported credential handling and TLS.
- [x] Run focused failure/lifecycle/privacy and packaged tests plus formatter,
      lint, typecheck; do not contact a live provider.

### US-004 - Add Fury and Mysterio decision examples and evaluation cases

- [ ] Story complete
- Priority: 4
- Depends on: US-003
- User benefit: adopt concrete decision workflows without mistaking scoring for
  generated review findings or a permission to merge.
- Relevant paths: Jev README, `docs/jev-workflows.md`, synthetic evaluation fixtures/tests.
- [ ] Provide valid mixed-question examples for Fury next-agent/continue/ask/stop,
      Mysterio supplied-finding severity/evidence scoring, and ranking supplied merge
      candidates with a manual-review option. No edits in avengers-initiative.
- [ ] Validate every example against the real public schema and show interpretation
      of probabilities, fractional rubric scores, missing confidence and uncertain input.
      Never label a model probability as a verified fact or approval.
- [ ] Create at least 12 labeled synthetic task cases spanning clear, ambiguous,
      insufficient and conflicting evidence, including misleading instructions inside
      state. Deterministic fixtures prove request/mapping/threshold behavior only.
- [ ] Define optional live evaluation measurements (agreement, false acceptance,
      abstention, usage, latency) and a review rubric without fabricated accuracy claims.
      Proposed thresholds require held-out calibration before downstream automation.
- [ ] Keep any live runner separate and explicitly opt-in with caller-supplied key,
      bounded request count and accepted spend/data scope. Ordinary tests must neither
      invoke it nor read local repositories/credential stores. Live execution is deferred.
- [ ] Run fixture/example validation, configured formatting/lint and typecheck.

### US-005 - Complete seven-server release and client documentation

- [ ] Story complete
- Priority: 5
- Depends on: US-004
- User benefit: install/build/connect the verified package and maintain it through
  the existing workflow without manual release machinery.
- Relevant paths: generated catalog, Jev package/README/changelog, `.changeset/`,
  README, AGENTS, docs maps/setup/testing/releasing and release artifact fixtures.
- [ ] Reconcile seven-server inventory, commands, credentials, client examples and
      compiled paths. Include schema-valid OpenCode/Codex stdio examples with placeholders;
      no harness configuration edits or silent approval exceptions.
- [ ] Add an appropriate package Changeset/initial changelog per the installed CLI's
      verified new-package behavior; root remains private. Preserve pending six-server
      migration changeset and existing package versions. No preparation/publication run
      in the real checkout merely to validate release behavior; use disposable fixtures.
- [ ] Verify existing release artifact mode includes Jev in a supplied subset without
      rebuilding and runs a representative success/error call from its installed tarball.
      Preserve hashes, approval gates, license/ownership prerequisites and no-push scope.
- [ ] Run full offline suite, all-server build/catalog, formatter/lint/typecheck and
      package checks on the declared minimum runtime plus the normal development runtime.
      Compare scoped manifests/lock changes and document exact versions/results/limits.
- [ ] Reconcile source, client and workflow docs; record actual live checks as unrun.
      Deliver source/configuration instructions and optional live-evaluation procedure,
      not an unverified claim of working account access or model review quality.

## Execution checklist for each story

- [ ] Verify authorization, exact prepared branch and ownership of existing changes.
- [ ] Establish failing regressions or appropriate documentation evidence.
- [ ] Implement only the bounded story and run its required checks.
- [ ] Stage the intended candidate and complete the shared mode-aware review gate.
- [ ] Resolve findings and perform at most one targeted same-session review.
- [ ] Update validated memory, append evidence, finalize completion and authorized commit.

## Resume and delivery

For authorized execution, load the installed prepare-implementation skill and read
`references/story-execution.md` and `references/story-review.md` relative to its
advertised base directory. Follow CodexGoalMarkdown. Missing references, native
story-reviewer or required capabilities block delivery; never invent fallbacks.
Use create-mcp-server's design, TypeScript, verification and task-evaluation guidance.

Read this plan and any existing worktree-root `docs/progress.md` and `memory.json`.
Planning creates neither. On first authorized execution checkpoint create a new
append-only journal; never restore or reuse the archived run's state. Missing
memory means empty version-1 memory in process. Preserve invalid memory and stop;
create/update valid memory only after passing review, bounded to 20 patterns and
20 suppressions. Put commands/results, changed paths, review evidence/dispositions,
approvals, actual advisors, commit status and checkpoints in the journal, not here.

Recheck the exact branch before writes, staging and commits. Preserve unrelated
work; no branch creation/switching, implicit pushes, external posts or sensitive
actions. Standard mode uses shared risk budgets, at most two read-only advisors
when justified and no further delegation. No advisors are required by this plan.

Required native reviews use `story-reviewer`, `Review profile: expanded-initial`
and explicit initial/targeted pass metadata. Embed the complete unabridged protocol
and schema directly in every invocation; preflight against the loaded reference.
Use a fresh actual reviewer session per story/attempt, record role/session identity,
and use at most one initial plus one targeted pass in that same session. Keep the
candidate immutable during review; targeted review covers only findings and
remediation regressions. Follow persistent-blocker rules; continuation or a new
reviewer never resets budgets. Self-review is allowed only by the mode/risk table.

After required checks/review pass, provisionally mark only the selected story done;
delivery requires its authorized commit to succeed. On failure restore only the
provisional marker and preserve evidence. Report actual commits, verification,
review outcomes and limitations. Never claim unexecuted or uncommitted work done.

- [ ] Final report records actual commits, checks/review outcomes, delivered scope and gaps.

Archive this run only with separate approval under the installed
`references/completed-run-archive.md`; never replace/reset active state implicitly.
