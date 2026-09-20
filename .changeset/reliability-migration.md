---
"@crsiebler/mcp-canvas-server": major
"@crsiebler/mcp-clickup-server": major
"@crsiebler/mcp-elasticsearch-server": major
"@crsiebler/mcp-flight-server": major
"@crsiebler/mcp-postgresql-server": major
"@crsiebler/mcp-salesforce-server": major
---

Require Node.js 22.14 or newer and move repository launches to each package's
`dist/servers/<server>/src/index.js`. Supply nonblank credentials and valid typed
settings; diagnostics now use redacted, bounded JSON on stderr. The new npm scope
is `@crsiebler`; these changes do not transfer packages published under another scope.

Review the affected server's migration notes before upgrading:

- Canvas keeps 185 tools by default and adds optional category selection. Course
  pagination is opt-in; consume its documented wrapper only when requested.
- ClickUp Folder/Space task lookups and user lookup now require a Workspace ID.
  Comment cursors require both fields; goal creation validates required fields.
  Tool failures return safe error envelopes rather than raw provider messages.
- Elasticsearch preserves partial failures and validates inputs. Consume nullable
  totals/scores and inspect MCP error flags and operation counts for partial results.
- Flight replaces `duffel_cancel_order` with separate quote and confirmation tools.
  Obtain a current cancellation quote and confirm its exact order/quote identifiers;
  reconcile uncertain results before retrying.
- PostgreSQL verifies TLS by default. Configure a trusted CA or explicit local
  non-TLS mode as documented. Queries are no longer rewritten to remove LIMIT 100;
  inspect truncation indicators and treat timeouts as potentially uncertain results.
- Salesforce bulk deletion returns ordered per-record outcomes and marks partial
  failure through MCP. Check each record result; do not assume all records succeeded.

Review the pending versions against registry ownership/history before the first
release. These are unreleased migration notes, not a claim of publication.
