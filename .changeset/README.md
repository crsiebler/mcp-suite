# Changesets

Run `npm run changeset` from the repository root to describe a consumer-visible
change. Commit the resulting Markdown file with its implementation. See
[contribution guidance](../docs/server-development.md#releases) and
[release preparation](../docs/releasing.md).

Package versions are independent. Shared code is compiled into each server:
explicitly select every affected consumer; Changesets cannot infer copied code.
The private root is never versioned, tagged or published by this configuration.

`baseBranch` currently names the prepared local branch `codex/clean-slate`.
Before hosted activation, choose the actual remote integration branch and update
this setting and the CI configuration together. This is not a remote-branch claim.
