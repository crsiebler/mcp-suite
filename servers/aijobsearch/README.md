# AI Job Search MCP Server

An MCP server for AI-powered job search functionality, providing skills extraction and job matching capabilities.

## Features

- **Skills Extraction**: Extract skills from text using taxonomy mappings, LLM prompts, and RAG
- **Job Matching**: Find jobs that match skills or descriptive text

## Installation

```bash
npm install @crsiebler/mcp-aijobsearch-server
```

## Configuration

Set the following environment variables:

- `AIJOBSEARCH_API_URL`: API base URL (default: https://api-main-poc.aiml.asu.edu)
- `AIJOBSEARCH_API_TOKEN`: Your API access token (required)

## Available Tools

### extract_skills
Extract skills from text using taxonomy mappings.

**Parameters:**
- `taxonomy` (string): Skills taxonomy to use (recommended: "lightcast")
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

## Usage

```javascript
// Extract skills from text
const skills = await extractSkills({
  taxonomy: "lightcast",
  context: "Software Engineer with experience in web development..."
});

// Match jobs by skills
const jobs = await matchJobs({
  type: "skills",
  skills_list: [
    {
      title: "Software Engineering",
      description: "Software Engineering...",
      taxonomy: "lightcast"
    }
  ]
});

// Match jobs by text
const jobsByText = await matchJobs({
  type: "text",
  context: "Your resume text here..."
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
{"success":false,"error":{"code":"rate_limited","message":"Provider rate limit reached. Wait before retrying.","retryAfterSeconds":30}}
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
character and is preserved exactly; skills mode requires an array with valid
`title`, `description` and `taxonomy` text fields. Tool schemas describe these
requirements. Extra skill fields are not forwarded. Provider responses remain
`unknown` until the provider-specific contract is verified; this migration checks
MCP output/envelope serialization, not the remote provider's complete data schema.
The TypeScript provider interfaces alone are not runtime validation.
