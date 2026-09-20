# Jev MCP server

Evaluate caller-supplied state using TypeSafe AI Jev through Vercel AI Gateway.
`jev_evaluate` returns boolean probabilities, choices and fractional rubric scores;
it does not generate code, find review issues or resolve merge conflicts itself.

Requires Node >=22.14.0 and a Vercel AI Gateway team API key. No Docker, Vercel CLI
or hosting deployment is required. From the repository root, build with
`npm run build -- --server=jev`; configure your MCP client to launch
`node /absolute/path/to/mcp-suite/servers/jev/dist/servers/jev/src/index.js`.
Supply `AI_GATEWAY_API_KEY` in the launch environment, never in tool arguments.
Optional `JEV_TIMEOUT_MS` defaults to 30000 (100–120000); `LOG_LEVEL` defaults to info.
No `.env` file is loaded. See [Fury/Mysterio examples](../../docs/jev-workflows.md). Client configuration
examples are completed in the final documentation story.

Evaluations send supplied data externally and may incur charges. Discovery makes
no provider requests. Calls request zero retention/no training routing, allow only
the TypeSafe provider, and never automatically retry or select a fallback model.
Gateway observability settings are separate. No live account check has been run.

Input: `{state, questions}`. State is JSON text/object/array (64 KiB, depth16).
Questions: 1–16 named boolean/choice/score evaluations; instructions <=4 KiB UTF-8,
criterion descriptions <=2 KiB, choice options 2–32, score levels 2–10. Combined
request <=128 KiB. IDs use letters/digits/underscore/hyphen, 1–64 characters;
prototype-sensitive IDs are rejected. Instructions and descriptions are strings.

Results contain `answers`, `requestedModel`, and optional validated `usage`,
`confidence` and `rounding`, as structured content plus matching JSON text.
Missing confidence or probability distributions remain absent. Confidence differs
from P(true); neither proves correctness or grants approval. Errors use `isError`
and static error codes/messages, without provider bodies. Concurrency is two;
extra work fails immediately. Provider body <=1 MiB; public result <=128 KiB.

See [the design](../../docs/jev-design.md) for validation and privacy details.
Package is source-only until separately published. Existing publication/license
prerequisites remain in [release documentation](../../docs/releasing.md).
