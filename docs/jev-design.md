# Jev evaluation server design

Verified 2026-09-20. This freezes the implementation contract; it is not evidence
of live account access, model accuracy, or an installed MCP server.

## Provider and package selection

Use the official AI SDK evaluation API through Vercel AI Gateway. Targeted Exa
searches of vendor documentation did not establish a vendor-maintained Jev MCP
server. The official SDK provides evaluation, authentication and response parsing;
the custom stdio adapter provides MCP discovery, bounds and caller-safe results.
No custom chat endpoint or model-generated JSON parser is needed.

| Direct runtime dependency   | Exact version | Evidence                                                        |
| --------------------------- | ------------- | --------------------------------------------------------------- |
| `ai`                        | `7.0.105`     | Published `experimental_evaluate`, Node >=22                    |
| `@ai-sdk/gateway`           | `4.0.85`      | Version used by ai 7.0.105; `createGateway().evaluationModel()` |
| `@ai-sdk/provider`          | `4.0.17`      | Shared experimental evaluation V4 types                         |
| `@modelcontextprotocol/sdk` | `1.30.0`      | Existing Flight line; Node >=18; structured tool results        |
| `zod`                       | `3.25.76`     | Satisfies AI SDK ^3.25.76 and MCP ^3.25 peers                   |

Official npm version metadata and the first three packages' published declaration
and implementation files were inspected. AI and Gateway both resolve provider-utils
5.0.43. Gateway exports ESM `dist/index.js`; use an ESM workspace. MCP's optional
`@cfworker/json-schema` peer is not required for this design. Root Zod 3.25.64 does
not satisfy AI's peer; retain existing consumers and give Jev a compatible explicit
pin. Prove the resolved lock, isolated installation and compiled imports in US-002.
The declared Node minimum remains 22.14.0; dependencies require no increase.
The evaluation interface is experimental and may change in patch releases, hence
exact pins and real SDK contract fixtures.

Sources: [AI SDK reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/evaluate),
[Gateway provider](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway),
[AI package metadata](https://registry.npmjs.org/ai/7.0.105),
[Gateway metadata](https://registry.npmjs.org/@ai-sdk%2fgateway/4.0.85),
[provider metadata](https://registry.npmjs.org/@ai-sdk%2fprovider/4.0.17),
[MCP metadata](https://registry.npmjs.org/@modelcontextprotocol%2fsdk/1.30.0),
[Zod metadata](https://registry.npmjs.org/zod/3.25.76).

## Operation and configuration

`jev_evaluate({state, questions})` evaluates one shared state and returns one
answer per question. It sends supplied data to Gateway and can incur charges.
It performs no implicit file, URL, repository or database reads or domain writes.
No resources or prompts are needed. Annotations are `readOnlyHint: true`,
`destructiveHint: false`, `openWorldHint: true`, `idempotentHint: false`; they do
not grant permission or make probabilistic, billed requests idempotent.

The workspace is `servers/jev`, package `@crsiebler/mcp-jev-server`, executable
`mcp-jev`, entry `dist/servers/jev/src/index.js`. Author is Cory Siebler
<cory.siebler@phitechsolutions.com>. It is a local Node stdio process, with no
Vercel CLI, hosting project, Docker or separate TypeSafe key requirement.

Require nonblank `AI_GATEWAY_API_KEY`, preserving its bytes for SDK handling.
Optional `LOG_LEVEL` uses the existing shared parser. `JEV_TIMEOUT_MS` is a strict
decimal integer 100–120000, default 30000. Read no `.env` or credential store.
Discovery performs no provider request. The user approved plan execution with
no key established; all required verification uses synthetic credentials and
provider I/O fixtures. Live evaluation remains separately opted in.

Construct an explicit Gateway instance with the key and bounded fetch. Fix the
model to `typesafe-ai/jev`; do not accept a model, endpoint, headers or provider
options from tool inputs. Let the SDK own its `/v4/ai/evaluation-model` protocol.
Call `experimental_evaluate` with `maxRetries: 0`, the combined abort signal and
`gateway: {only: ['typesafe-ai'], zeroDataRetention: true,
disallowPromptTraining: true}` provider options. No model fallback list or retry
loop. The pinned Gateway types document these routing filters, and its evaluation
implementation forwards providerOptions. Reject warnings before core's default
warning logger runs, including unsupported/compatibility warnings; never relax
controls after a failure. A wrapper around the real model's `doEvaluate` can reject
warnings without altering process-global logging or bypassing core validation.

Routing flags request upstream privacy controls; offline fixtures cannot establish
service enforcement, and they do not disable Gateway team logs. Review account
observability settings before sending private data. API keys are team-scoped.
See [authentication](https://vercel.com/docs/ai-gateway/authentication-and-byok/authentication)
and the [Jev guide](https://vercel.com/kb/guide/typesafe-jev-and-ai-sdk).

## Input contract and limits

Reject additional top-level and question fields. Preserve supplied text exactly.
State is a string, plain JSON object or JSON array, with finite numbers, no cycles,
undefined, accessors or exotic objects. Nested null and booleans are allowed;
root null, numbers and booleans are not. Limit serialized state to 65536 UTF-8
bytes and nesting to 16 (root depth zero). Traverse with a bounded budget before
serialization to avoid oversized/deep values monopolizing validation.

Questions are a map of 1–16 safe IDs. Question and choice IDs match
`^[A-Za-z0-9_-]{1,64}$`, excluding `__proto__`, `prototype`, and `constructor`.
Instructions are nonblank strings up to 4096 UTF-8 bytes. Criterion descriptions
are strings up to 2048 UTF-8 bytes; empty descriptions are allowed. These text-only
instructions/descriptions deliberately narrow the SDK's structured/null variants.

| Question | Criteria                                                       | Answer                                       |
| -------- | -------------------------------------------------------------- | -------------------------------------------- |
| boolean  | Optional object with only optional `true`/`false` descriptions | `{type: 'boolean', probability}` for P(true) |
| choice   | Required map of 2–32 named descriptions                        | `{type: 'choice', choice, probabilities?}`   |
| score    | Required ordered array of 2–10 descriptions                    | `{type: 'score', score, probabilities?}`     |

Combined serialized `{state, questions}` must not exceed 131072 UTF-8 bytes.
An array state is shared context, not independent batched evaluations. No implicit
truncation or rewriting. These are local byte policies, not provider token limits.

## Output and validation

Success is `{answers, requestedModel, reportedModel?, usage?, confidence?, rounding?}`.
Return it in both native `structuredContent` and one matching JSON text block,
with an advertised output schema. Errors use `isError: true` and safe JSON text;
no success-shaped structuredContent on failure.

Core validates exact answer IDs and types. All probabilities are finite [0,1].
Choice must select an existing maximum-probability option when a distribution is
present. Score is fractional within [0, rubric length - 1], and equals the
probability-weighted zero-based index when a distribution exists. Optional
probabilities are omitted if absent; when present they must contain exactly every
option/level key. Never fabricate or renormalize them.

Use the pinned core's validation: tolerance 1e-6; rounding decimals must be integers
0–15. For n probabilities rounded to d decimals, sum tolerance is
`1e-6 + n * 0.5 * 10^-d`. Weighted score tolerance adds each index times its
probability rounding error and the score's half-unit rounding error. Missing
rounding contributes zero. Choice maximality tolerance is 1e-6. Preserve numbers
and valid precision declarations. Do not treat coarse rounding as calibration.

Project only validated `providerMetadata.typesafe.confidence` values: known
choice/score IDs and finite [0,1] numbers. Absent confidence stays absent; malformed
confidence fails the result. Boolean probability is not confidence. Ignore all
other metadata. Usage fields are optional nonnegative safe integers inputTokens,
outputTokens and totalTokens; total is present only when both components exist and
their sum is safe. Invalid known metadata fails rather than producing a decision.

Always identify requestedModel. The pinned Gateway implementation sets response
modelId from its configured model ID, not a server-returned identity: omit
reportedModel rather than imply independent provider confirmation. No timestamps,
raw response IDs, bodies, headers or warnings are public. The public result is
bounded to 131072 UTF-8 bytes and the complete upstream body to 1048576 bytes,
including errors and streams without Content-Length. Oversize fails, never truncates.

## Failures and lifecycle

Use static error messages and stable codes: `INVALID_INPUT`, `UNAUTHORIZED`
(401/403), `MODEL_UNAVAILABLE` (404/unsupported model), `RATE_LIMITED` (429),
`PROVIDER_UNAVAILABLE` (5xx/network), `INVALID_RESPONSE`, `RESPONSE_TOO_LARGE`,
`PROVIDER_WARNING`, `TIMEOUT`, `CANCELLED`, `OVERLOADED`, `SHUTDOWN`, and
`INTERNAL_ERROR`. Do not echo input, dynamic paths, provider messages or error causes.
Numeric retry-after may be exposed only after strict bounded validation; no retry
is performed. When its provenance is uncertain, omit it.

Validate before provider I/O. Permit at most two in-flight calls; reject a third
immediately, with no queue. Timeout bounds the entire evaluation, including body
consumption; combine it with MCP cancellation and server shutdown. Cancel streams
on overflow, release timers/listeners/slots on every path, and do not start calls
after shutdown. EOF, SIGINT and SIGTERM abort outstanding evaluations and close the
MCP transport; verify actual child exit. Local cancellation cannot prove remote
billing stopped. Logs use static shared logger messages only.

## Remaining limits and verification

US-002 establishes the real packaged SDK path; US-003 proves failure, cancellation
and privacy boundaries. US-004 supplies labeled synthetic Fury/Mysterio fixtures;
US-005 verifies release artifacts and client docs. No assertion of model accuracy,
free-weekend pricing, account entitlement or server-side retention enforcement is
made. Prices/quotas/context metadata vary; check the account before live use.

The [evaluation guide](https://vercel.com/docs/ai-gateway/modalities/evaluation)
describes AI SDK evaluation and excludes OpenAI/Anthropic/Cohere compatibility.
There is also an official [TypeSafe-compatible API](https://vercel.com/docs/ai-gateway/sdks-and-apis/typesafe),
which uses different TypeSafe question names. This does not change the selected
SDK implementation and is not an MCP server. Existing chat-provider integrations
cannot be assumed to call this evaluation modality.
