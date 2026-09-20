# AI Job Search MCP Server

An experimental MCP adapter for skills extraction and job matching. Its local
contracts are tested, but the provider-specific API contract remains unverified.

## Provider readiness: unresolved

As of 2026-09-20, the official [CreateAI introduction](https://docs.aiml.asu.edu/)
identifies `https://api-main-poc.aiml.asu.edu` as a **POC environment**. Its
[published endpoint index](https://docs.aiml.asu.edu/llms-index.txt) lists query,
search, audio, vision, speech, image, reranker, realtime, embeddings and project
management. Neither that index nor targeted official-domain research established
`POST /skills`, `POST /jobs`, their response schemas, or accepted taxonomy names.
This is missing evidence, not proof those private routes do not exist.

**Live-readiness blocker:** obtain the provider's endpoint/version contract,
accepted taxonomy identifiers, response schemas, account entitlement and data
handling terms. Then reconcile the provisional shapes below and perform separately
authorized integration checks with synthetic content. General CreateAI access does
not establish support for this adapter. No resume or private data was submitted
during verification.

## Features

- **Skills Extraction**: Extract skills from text using taxonomy mappings, LLM prompts, and RAG
- **Job Matching**: Find jobs that match skills or descriptive text

## Installation

```bash
npm install @crsiebler/mcp-aijobsearch-server
```

## Configuration

Set the following environment variables:

- `AIJOBSEARCH_API_URL`: Required HTTP(S) API base URL confirmed by your provider; no default. Query/fragment/userinfo are rejected. A path prefix is supported.
- `AIJOBSEARCH_API_TOKEN`: Your API access token (required)

## Available Tools

### extract_skills

Extract skills from text using taxonomy mappings.

**Parameters:**

- `taxonomy` (string): Taxonomy identifier confirmed by your provider (required; no verified default)
- `context` (string): Job description, resume, or text block to extract skills from

### match_jobs

Find jobs that match skills or text.

**Parameters:**

- `type` (string): "skills" or "text"
- `skills_list` (array): Array of skills (required when type='skills')
  - `title` (string): Skill title
  - `description` (string): Skill description
  - `taxonomy` (string): Taxonomy name
- `context` (string): Resume or text block (required when type='text')

The previous implicit POC URL has been removed. Existing clients must now set
`AIJOBSEARCH_API_URL` explicitly. Selecting a URL does not establish provider
support. The bearer-token header is unchanged; no token acquisition or scope
logic was added. The old `lightcast` recommendation/default was not verified and
has been removed from discovery. Examples below use placeholders, not supported
taxonomy assertions.

## Usage

```javascript
// Extract skills from text
const skills = await extractSkills({
  taxonomy: "provider-confirmed-taxonomy",
  context: "Software Engineer with experience in web development...",
});

// Match jobs by skills
const jobs = await matchJobs({
  type: "skills",
  skills_list: [
    {
      title: "Software Engineering",
      description: "Software Engineering...",
      taxonomy: "provider-confirmed-taxonomy",
    },
  ],
});

// Match jobs by text
const jobsByText = await matchJobs({
  type: "text",
  context: "Your resume text here...",
});
```

## License

MIT

## Response contract

Both tools now return MCP text containing a shared result envelope. Successful
responses have `isError: false` and JSON `{ "success": true, "data": ... }`.
Previously the provider object appeared directly in the text: clients must now
read `data.skills_list` or `data.jobs_list` after checking `success`.

Input/provider failures have `isError: true` and JSON such as:

```json
{
  "success": false,
  "error": {
    "code": "rate_limited",
    "message": "Provider rate limit reached. Wait before retrying.",
    "retryAfterSeconds": 30
  }
}
```

Errors no longer expose raw provider messages, bodies, URLs or credentials.
Categories are `invalid_input`, `authentication`, `forbidden`, `not_found`,
`rate_limited`, `timeout`, `unavailable`, `provider_error`, `invalid_response`,
and `internal_error`. This is classification only; authentication and permissions
are unchanged. Unknown tool names remain MCP protocol errors.

`retryAfterSeconds` is optional advice for rate limits/unavailability, parsed from
a numeric delay or canonical HTTP-date and bounded to 0–2147483647 seconds.
Malformed values are omitted. There is no automatic retry; a timeout can have an
unknown outcome. Check before repeating an operation.

Arguments are validated at runtime. Required text must contain a non-whitespace
character and is preserved exactly; skills mode requires a nonempty array with valid
`title`, `description` and `taxonomy` text fields. Tool schemas describe these
requirements. Extra skill fields are not forwarded. Responses are validated against the provisional repository interfaces below,
not an authoritative provider specification. Non-object bodies, missing/wrong
arrays, malformed items and non-finite numeric relevance fields produce
`invalid_response`, including a successful HTTP response carrying an error-only
object. Empty result arrays are valid. Unknown fields are retained; relevance
scales and URL semantics are not verified.

| Operation        | Provisional response requirements                                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extract_skills` | Object with `skills_list` array; each skill has string `title`, `description`, `taxonomy_reference_link` and finite numeric `match_relevance`                                                 |
| `match_jobs`     | Object with `jobs_list` array; each job has string `title`, `description`, `job_site`, `link_to_job`, array `skills_matched` using the skill shape, and finite numeric `jobs_match_relevance` |

Successful envelopes retain provider fields. Previously malformed provider bodies
could be reported as success; clients must now handle `invalid_response`.
This runtime validation establishes only the local adapter contract and does not
resolve the live-readiness blocker.

## Local limits and request mapping

These are repository safeguards, not claimed provider quotas:

| Limit                                   | Value                                                      |
| --------------------------------------- | ---------------------------------------------------------- |
| Request deadline and Axios timeout      | 30 seconds; abort on deadline, timer cleared on completion |
| Serialized request body                 | 256 KiB UTF-8                                              |
| HTTP response and reserialized response | 1 MiB each                                                 |
| Text context                            | 64 KiB UTF-8                                               |
| Taxonomy                                | 256 bytes UTF-8                                            |
| Skill title / description               | 1 KiB / 4 KiB UTF-8                                        |
| Submitted skills                        | 1–100                                                      |

Runtime text bounds count UTF-8 bytes. Discovery `maxLength` values provide a
coarser character ceiling; multibyte text can hit the byte bound earlier.
Aggregate request validation includes JSON escaping overhead and occurs before
network access. Response limits are applied by Axios during receipt and again
before returning parsed data. Requests do not follow redirects or retry; the
existing URL/token configuration controls the initial request. Cancellation stops
the local wait but cannot prove the remote provider stopped processing.

`extract_skills` posts `{ taxonomy, context }` to `/skills`. Text matching posts
`{ type: "text", context }` to `/jobs`; skills matching posts
`{ type: "skills", context: { skills_list } }`. Only the three advertised skill
input fields are forwarded, preserving their original text. Trailing base-URL
slashes are normalized when joining the route.

## Verification

From the repository root:

```sh
npm ci
npm run build -- --server=aijobsearch
npm run type-check
npm test -- tests/unit/aijobsearch-contracts.test.ts tests/unit/aijobsearch-transport.test.ts tests/unit/aijobsearch-handler.test.ts
```

The built entry is `servers/aijobsearch/dist/servers/aijobsearch/src/index.js`.
Fixture tests exercise both tools and both matching variants, request/body limits,
malformed responses, empty results, deadlines/timer cleanup and error/log privacy.
Loopback-only HTTP tests verify actual Axios response-size enforcement, redirect
rejection and hanging-request cancellation. Packaging checks verify absent endpoint
failure without starting MCP. None establish live API availability or entitlement.
