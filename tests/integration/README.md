# Integration checks

The retained suites cover Duffel flight operations. See
[testing guidance](../../docs/testing.md) before running the suite.

- `flight-server.test.ts` requires credentials and can contact Duffel. Inspect
  calls and use an authorized test account.

Build and verify the actual compiled entry path before launching a suite. Early
returns are not proof that integration passed. Dependencies must already be installed; do not use
live credentials or install packages solely to validate documentation.
