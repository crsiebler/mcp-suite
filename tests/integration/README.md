# Integration checks

`flight-server.test.ts` is excluded from `npm test` and `npm run test:watch`.
Use `npm run test:live` only after scoped approval to contact Duffel with a test
account. It formally skips unless RUN_LIVE_TESTS=1, DUFFEL_API_KEY is set, and
DUFFEL_ENVIRONMENT is test (default). Do not log the token.

See [testing guidance](../../docs/testing.md) for the compiled entry path,
SDK-owned transport, checks performed, and limitations. Build the server before
an authorized live run. The offline service fixtures require no credentials.
