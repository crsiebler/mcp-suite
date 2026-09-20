# PostgreSQL MCP Server

Two tools expose SQL execution and the configured write-operation flag through
stdio MCP. Build from the repository root with locked workspace dependencies:

```sh
npm ci
npm run build -- --server=postgresql
node servers/postgresql/dist/servers/postgresql/src/index.js
```

A client launches that entry point with the settings below. Distributed packages
use `dist/servers/postgresql/src/index.js` relative to their installation directory.
Source changes described here require a release before they appear on npm.

## Connection settings

| Variable                                | Behavior                                                                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `POSTGRESQL_CONNECTION_STRING`          | Required `postgresql://` or `postgres://` connection URI; percent-encode special characters in credentials             |
| `POSTGRESQL_SSL_MODE`                   | `verify-full` by default; `disable` explicitly selects non-TLS for a local database                                    |
| `POSTGRESQL_SSL_CA`                     | Optional PEM contents of a trusted CA, used with `verify-full`; blank values and combining with `disable` are rejected |
| `POSTGRESQL_QUERY_TIMEOUT_MS`           | Integer 1–300000; default 30000 milliseconds                                                                           |
| `POSTGRESQL_MAX_ROWS`                   | Integer 1–10000; default 100 returned rows                                                                             |
| `POSTGRESQL_ALLOW_DANGEROUS_OPERATIONS` | Existing behavior: exactly `true` enables write operations; default `false`                                            |
| `LOG_LEVEL`                             | `debug`, `info`, `warn`, `error`; default `info`                                                                       |

Verified TLS checks the certificate chain and hostname. Supply a trusted CA for
private certificate authorities; there is no insecure certificate-verification
mode. The CA setting contains PEM text, not a path, and is passed to Node TLS.
Invalid certificates fail when connecting. Explicit CA configuration replaces
Node's default CA list. Credentials and authorization rules are unchanged.

Migration: the old service unconditionally disabled verification. Connections
using self-signed certificates now need a trusted CA. Local databases without TLS
need explicit `POSTGRESQL_SSL_MODE=disable`. `PGSSLMODE` does not override this
server's explicit TLS configuration. Connection URI parameters beginning with
`ssl`, plus `uselibpqcompat`, `options`, timeout overrides and `connect_timeout`,
are rejected; move the supported TLS/deadline settings to the variables above.
Ordinary URI parameters such as `application_name` remain supported.

This separation prevents the driver's URI parser from replacing explicit TLS
options, a behavior described in [node-postgres SSL configuration](https://node-postgres.com/features/ssl).
No client certificate authentication flow is added by this change.

## Tool contracts

- `execute_query`: required nonblank `query` string and optional `params` array
  of strings. Executes one SQL statement. Success remains JSON text containing
  `rows`, `rowCount` and `fields`, with new `returnedRowCount` and `truncated`
  fields. Failures remain text with MCP `isError: true`.
- `check_dangerous_operations_allowed`: no arguments; returns the existing
  `allowed` boolean and explanatory `message`.

SQL and parameters are passed unchanged; the server no longer appends `LIMIT`.
The output cap applies to SELECT, CTE and write RETURNING rows alike. `rowCount`
retains the driver's count; `returnedRowCount` counts delivered rows. An empty
result has `truncated: false`. The driver still buffers the complete result:
this cap does **not** bound database work, network transfer, row size or memory.
Use explicit SQL limits, selective predicates and pagination for large datasets.

Send one statement per call. Multiple result sets are rejected and rollback is
attempted; they previously produced an unusable single-result response. This is
not a SQL batch sandbox: with writes enabled, caller-supplied transaction commands
or operations with nontransactional effects can already have taken effect. Do not
use a failed tool response as proof that nothing changed.

## Execution and permissions

The pool has at most five clients and a 10-second connection/acquisition deadline.
After acquisition, BEGIN, SQL execution and COMMIT share one client deadline from
`POSTGRESQL_QUERY_TIMEOUT_MS`. The same value configures PostgreSQL's per-statement
`statement_timeout`, through the [driver configuration](https://node-postgres.com/apis/client).
Ordinary query errors attempt rollback with a separate five-second cleanup limit.
Timed-out clients, failed BEGIN/COMMIT and failed rollback clients are discarded.
A late acquisition is discarded without running SQL. Operations are never retried.

A client deadline closes an active connection; it does not prove immediate server
cancellation. Server timeout enforcement and termination depend on PostgreSQL,
network state and session settings. A timeout or lost COMMIT response can leave an
uncertain write outcome. Verify database state before deciding whether to retry.

Existing keyword/function checks and dangerous-operation flag behavior are
preserved. Allowed read queries use `BEGIN READ ONLY`. These checks are heuristics,
not a SQL parser or an authorization boundary; legitimate SQL can also be rejected.
Use a dedicated database role with only the required privileges, and avoid
privileged functions or administrative accounts. Configure roles separately;
this server does not create roles, grant permissions or run migrations.

Keep host approval enabled for `execute_query`, which accepts arbitrary SQL.
Only the flag-inspection tool is appropriate for automatic read-tool approval.
There are no separate `list_tables` or `describe_table` tools. Do not store
credentials in committed client configuration or log SQL/parameters.

## Offline verification

From the repository root:

```sh
npm test -- tests/unit/postgresql-config.test.ts tests/unit/postgresql-service.test.ts
npm run type-check
npm run lint
```

Configuration fixtures construct real driver objects without connecting. Lifecycle
fixtures replace the pool/client boundary and control clocks. They verify intended
TLS options, SQL preservation, truncation, rollback and disposal, not real server
certificate validation, SQL permission enforcement or cancellation timing. The
package suite separately checks built stdio startup; no live database is contacted.
