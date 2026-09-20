# Canvas tool exposure and verified contracts

Canvas exposes 185 tools in 15 categories. `servers/canvas/src/registry.ts`
registers each existing service/tool pair once. Discovery and dispatch use the
same selected map; a hidden tool name cannot bypass category selection. Duplicate
tool names fail startup. Category selection controls tool exposure, not Canvas
account permissions.

## Category configuration

Leave `CANVAS_TOOL_CATEGORIES` unset to retain all 185 tools. To select categories:

```sh
export CANVAS_TOOL_CATEGORIES="courses,pages"
```

This exposes 31 tools. Names are case-sensitive. Comma-separated entries may have
surrounding whitespace; duplicate entries are deduplicated. Empty strings, empty
entries and unknown names fail startup with the setting name, without printing
its value. Restart the server after changing its environment.

The inventory below is derived from actual tool registrations and verified by
`tests/unit/canvas-registry.test.ts` and `canvas-inventory.test.ts`.

| Category                   | Tools |
| -------------------------- | ----: |
| `courses`                  |    10 |
| `enrollments`              |    15 |
| `users`                    |    39 |
| `assignments`              |    12 |
| `submissions`              |    20 |
| `modules`                  |    18 |
| `external_tools`           |    12 |
| `quizzes`                  |    12 |
| `admins`                   |     4 |
| `grade_change_logs`        |     5 |
| `logins`                   |     5 |
| `authentication_providers` |     8 |
| `lti_launch_definitions`   |     1 |
| `pages`                    |    21 |
| `grading_standards`        |     3 |

Grade-change logs and LTI launch definitions have read operations only. Other
categories include mutations. Selecting a category does not approve its writes;
the host must apply its own approval policy. Existing service implementations for
logins, SSO and account permissions are unchanged.

## Course pagination

Existing `list_courses` calls retain their raw array result and make one request.
They do not automatically fetch every page. Canvas documents a default page size
of 10, an unspecified provider maximum, and opaque `Link` URLs for continuation.
See [official Canvas pagination](https://developerdocs.instructure.com/services/canvas/basics/file.pagination).

For explicit pagination, start with:

```json
{
  "name": "list_courses",
  "arguments": {
    "include_pagination": true,
    "per_page": 25,
    "enrollment_type": "teacher"
  }
}
```

The content is `{ "items": [...], "next_page_url": "..." }`. A null next-page URL
means the response supplied no next link; item count alone does not establish
whether another page exists. `per_page` accepts integers 1–100 (a local request
limit, not a claim about the provider maximum). Canvas may return fewer items.
It can also be supplied without opting into the object result.

To continue, pass the returned URL without reconstructing its query parameters:

```json
{
  "name": "list_courses",
  "arguments": {
    "include_pagination": true,
    "page_url": "https://your-school.instructure.com/api/v1/courses?opaque-cursor"
  }
}
```

The URL above is illustrative; use the actual returned URL. Do not combine
`page_url` with filters or `per_page`. Each call fetches one page, and explicit
pagination disables redirects. URLs must match the configured API origin and
exact course-list path. Credentials in URLs, fragments, access-token query
parameters and other endpoints are rejected. Invalid response arrays, ambiguous
next links or unsafe provider links produce a safe error, never an invented page.

This does not add automatic traversal, numeric page reconstruction, a byte-size
limit, or pagination support to other tools. Other list operations retain their
existing first-response behavior; their service methods generally discard `Link`
headers. Do not describe their output as a complete account or course inventory.

## Result compatibility

Successful tool content remains raw JSON. Existing methods returning void now
produce JSON `null`, so deletion responses remain valid MCP content. Failures use
MCP `isError: true` plus a safe JSON envelope:

```json
{
  "success": false,
  "error": {
    "code": "forbidden",
    "message": "Provider denied access. Check account permissions."
  }
}
```

Raw provider error messages/bodies are not returned. Unknown or hidden tools use
`invalid_input`; invalid course-page responses use `invalid_response`. Callers
that parsed the previous plain-text error strings must adopt the JSON envelope.
This does not change token selection, login/SSO behavior, or Canvas permissions.

## Verification and extension

Offline tests exercise every advertised tool through its existing handler and
service to a fake Axios adapter. Those 185 reachability cases check dispatch and
basic endpoint construction, not every argument's provider semantics. Explicit
method/path/body fixtures cover a read and, where available, write per category,
plus provider error formatting. Pagination fixtures verify opaque continuation,
legacy output, empty pages, limits and link rejection.

Packaged SDK checks verify all-tool startup, selected-category discovery, hidden
calls and invalid configuration, with network access blocked. None of these tests
perform live Canvas writes or establish real account privileges.

When adding a category, register its service/tool pair in `createCanvasGroups`,
add representative provider fixtures, and update this inventory from actual
registrations. The runtime derives tool-name dispatch automatically. Keep
`npm run type-check`, `npm run lint` and relevant offline tests passing; build and
package verification follow [server development](server-development.md).
