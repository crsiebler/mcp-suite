# Release preparation

Changesets owns independent package versions and package changelogs. The private
root owns tooling and is not a release target. Publication and GitHub announcement
wiring is pending US-015; no command below publishes, creates a release PR, commits,
tags, pushes or configures registry access automatically.

## Toolchain and branch

The repository pins `@changesets/cli` 3.0.1 and uses npm workspaces. Development
requires Node 22.14+ within the 22.x line, Node 24.x, or Node 26+, and npm 10.9+.
These reflect the installed CLI's supported engine ranges; server runtime minimums
remain Node 22.14. Install the root lockfile with `npm ci` after installation is
authorized. Do not use `npx` to fetch an unspecified release tool.

`.changeset/config.json` uses public access, no fixed/linked groups, no automatic
commits, and no private-package versioning/tagging. Its explicit `baseBranch` is
currently the prepared **local** branch `codex/clean-slate`. Keep that branch
available for CLI comparisons; on another feature branch use
`npm run changeset -- --since=<verified-ref>` when appropriate.
Before hosted activation, choose the actual remote integration branch and update
Changesets and the workflow together. The local branch does not establish the
remote default or permission to push.

Monorepo release tags use the documented Changesets convention
`<package-name>@<version>`, for example
`@crsiebler/mcp-postgresql-server@2.0.0`. The old `postgresql-v2.0.0` form is retired.
Neither `git-tag` nor `publish` is a preparation/verification command.

## Contribution and preparation

1. Follow [contribution guidance](server-development.md#releases), select affected
   packages, and commit a Changeset with the implementation under normal approval.
2. Inspect pending release choices with `npm run release:status`. To retain the
   machine-readable plan, first create a project-local scratch directory, then run
   `npm run release:status -- --output=dist/release-status.json`. This status file
   describes proposed version changes, not confirmed registry publication.
3. In a clean, authorized release-preparation checkout, run `npm run release:version`.
   This runs the installed `changeset version`, synchronizes the root lock using
   `npm install --package-lock-only --ignore-scripts --offline --no-audit --no-fund`,
   then regenerates the catalog from current builds. Populate the dependency cache
   through the approved frozen installation first; a cache miss stops preparation.
4. Review every changed manifest, package changelog, lock entry and catalog version.
   Changesets consumes the included Markdown files. Unchanged packages must retain
   their versions. The root must remain private and unchanged in version.
5. Edit generated changelog prose for clarity and migration instructions before
   verification. Do not change published history or invent previous release events.
6. Run the checks below and review the diff. Commit only the reviewed release files
   with an approved Conventional Commit such as `chore(release): prepare package versions`.
   Stage explicit paths; never blindly stage unrelated work. Hosted release-PR
   creation and publication are separate steps, pending their implementation/setup.

The preparation command can modify files and run builds. It does not roll back
partial local changes: if lock synchronization or compilation fails after versioning,
inspect the consumed Changesets/manifests/changelogs, fix the cause, and rerun the
failed lock/catalog step. Do not repeatedly version an ambiguous partial state.
Retain a reviewed pre-preparation commit for comparison; never reset unrelated work.

## Verification commands

From the root, after approved dependency installation:

```sh
npm run type-check
npm run lint
npm test
npm run catalog:check
npm run build -- --server=all
mkdir -p dist/release-review
npm pack --workspaces --pack-destination=dist/release-review --json
```

Run `npm run format -- <changed-files>` before final checks; range-format small
legacy documentation changes. `npm test` includes real prepack builds, tarball
installation, SDK discovery/calls and cleanup with provider access blocked.
`npm pack` executes prepack and produces review artifacts; it does not publish.
Inspect each tarball's files/main/bin and match it to the selected package/version.
The future publication step must consume the exact artifacts it verifies, without
an unchecked rebuild. The current test suite has the dependency-closure limitations
recorded in [testing](testing.md); offline checks do not prove live permissions.

`npm ci --ignore-scripts --offline --no-audit --no-fund` validates the frozen
lockfile against an already populated cache without package lifecycle execution.
A failure must be resolved before release; do not rewrite the lock just to suppress
it. Changesets fixtures run the actual pinned CLI against disposable repositories
under `dist/test-artifacts`, including independent/breaking/dependent/no-release
cases, lock synchronization and unchanged Git HEAD/index/tags.

## Changelogs and release statements

Each `servers/<name>/CHANGELOG.md` is the source for that package's future release
statement. Changesets groups contributor summaries by bump type and records
internal dependency updates. Review the generated version section for the user
impact and migration steps. Conventional Commit messages remain required for Git,
but are not parsed into a second competing changelog.

The root [CHANGELOG](../CHANGELOG.md) records suite-wide changes and links to
package histories. [releases/](../releases/README.md) preserves the old records
without generating new duplicate JSON/Markdown payloads. New GitHub Releases will
use the appropriate package changelog section only after npm publication is
confirmed. Artifact provenance identifies the build source; it does not replace
user-facing release notes.

## First-release prerequisites

The clean-slate root commit `8b760c7` is the new history boundary; original history
remains on the retained main branch. Do not reconstruct release notes from the
squashed commit. Existing manifest versions and old npm scope are not evidence of
ownership or publication under `@crsiebler`.

Before selecting/approving the first actual releases:

- Inspect each current package name, public registry versions/dist-tags, ownership
  and applicable existing Git tags. For a selected package, read-only
  `npm view <package> versions dist-tags --json` and `npm owner ls <package>` help;
  registry absence alone does not prove the current account can publish that name.
- Confirm the account/scope and per-package publisher permissions through the
  registry's supported setup. Do not log credentials. A name change creates a new
  package identity; it does not transfer upstream ownership or versions.
- Review the pending migration Changesets against the verified registry baseline.
  Major bumps are proposed for breaking runtime/configuration/tool contracts.
  Do not reset versions, claim unpublished releases, or use publication as a test.
- Resolve [license provenance](licensing.md) for the actual distributed artifacts.
  The unavailable original notice remains a publication prerequisite.
- Choose the remote integration branch, approve hosted workflow activation and
  configure per-package trusted publishing and the publication approval boundary.
  These external operations are not authorized by local plan execution.

Until these prerequisites and US-015 are complete, publication remains disabled
in the supported repository workflow. The CLI's own publishing subcommands still
exist and are external write operations requiring separate authorization.

## Sources

Verified against pinned CLI 3.0.1 and its installed behavior, with official
[configuration](https://changesets.dev/guide/config),
[CLI commands](https://changesets.dev/guide/cli),
[npm lockfile-only installation](https://docs.npmjs.com/cli/v11/commands/npm-install/)
and [npm lifecycle](https://docs.npmjs.com/cli/v11/using-npm/scripts/) documentation.
