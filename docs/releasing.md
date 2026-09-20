# Release workflow

Changesets owns independent package versions and package changelogs. The private
root owns tooling and is not a release target. GitHub workflow definitions separate
version-PR preparation, candidate verification and approved publication. They are
disabled until the external activation prerequisites below are deliberately set.
Local preparation and artifact validation commands never publish.

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
   creation and publication are separate manually dispatched workflow operations.

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
The publication job consumes the exact artifacts it verifies, without
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

Until these prerequisites are complete, publication remains disabled
in the supported repository workflow. The CLI's own publishing subcommands still
exist and are external write operations requiring separate authorization.

## Hosted activation and approval

Activation requires separate authorization; editing workflow files does not grant
it. Choose a remote integration branch, put the workflows on the repository's
default branch so manual dispatch is available, and set `.changeset/config.json`
`baseBranch` and repository variable `RELEASE_BRANCH` to the chosen integration
branch. Do not infer either from this checkout. Protect that branch and require
the Verify workflow's checks for implementation and release PRs.

Configure these repository variables only after their associated review:

| Variable                   | Required value     | Meaning                                 |
| -------------------------- | ------------------ | --------------------------------------- |
| `RELEASE_WORKFLOW_ENABLED` | `true`             | Authorize manual version-PR preparation |
| `RELEASE_BRANCH`           | Chosen branch name | Exact permitted dispatch branch         |
| `NPM_PUBLISHING_ENABLED`   | `true`             | Authorize the publication workflow      |
| `TRUSTED_PUBLISHERS_READY` | `true`             | Per-package npm configuration reviewed  |
| `LICENSE_REVIEWED`         | `true`             | Applicable distributed notices resolved |

Create GitHub environment `npm-publish` with required reviewers, prevention of
self-approval, disabled administrator bypass, and deployment branch restrictions
limited to the chosen release branch. A GitHub plan supporting required reviewers
is necessary. Preflight reads the environment and refuses missing reviewers or
self-approval. Reviewers must deny jobs whose source SHA, artifact or setup is
uncertain; a denied job must not be rerun as an approval workaround. The workflow
does not create the environment or configure its rules. Verify the branch policy
and bypass settings during activation; the API preflight does not validate them.

For **each of the six npm packages**, configure npm's GitHub Actions trusted
publisher with owner `crsiebler`, repository `mcp-suite`, workflow file
`release.yml`, and environment `npm-publish`. Verify ownership and the registry's
first-publication setup process before enabling publication. Never bootstrap a
missing package by secretly adding an npm token to this workflow.

Publication runs on GitHub-hosted `ubuntu-latest` with Node 24 and requires npm
11.5.1 or newer. The job checks npm/OIDC availability and rejects supplied
`NPM_TOKEN`/`NODE_AUTH_TOKEN`. `setup-node` does not configure token authentication;
no npm token secret is referenced. Keep project/runner npm configuration free of
alternate credentials or registry overrides. Only the publication job has
`id-token: write`; version preparation has contents/PR write but no OIDC. Preflight
has contents/read and actions/read for authenticated environment inspection;
the added Actions permission is confined to that job. Public
repository/public-package trusted publication can generate npm provenance
automatically. Verify its registry attestation after release; checksums and
changelog prose are not provenance.

## Running the defined workflow

`.github/workflows/verify.yml` runs read-only verification on pull requests or
manual dispatch. `.github/workflows/release.yml` is manual-only, serialized across
the repository with cancellation disabled. It has no push-triggered publication.
Every dispatch must select the configured integration branch. Changing activation
variables, environment rules or publisher settings is a separate external action.

1. Dispatch **prepare** to run Changesets Action's pinned `version@v2.1.1`.
   `npm run release:version:ci` runs version/lock/catalog preparation and then
   typecheck, lint, offline tests and catalog validation before the Action creates
   or updates its draft version PR. GitHub-token-created PRs may not trigger other
   workflows automatically; these in-job checks do not depend on that trigger.
   The generated `changeset-release/<branch>` branch is bot-owned and regenerated;
   do not use it as a shared development branch. Review changes before merging.
2. After the version PR is reviewed and merged, dispatch **publish**. The candidate
   job checks current source, queries the registry using maintained
   `changeset publish-plan`, builds/packs the selected unpublished versions and
   tests those exact tarballs over MCP. It seals and uploads a run-specific artifact.
   Missing notes, empty plans and unsafe prerelease tags stop before approval.
3. Review the candidate SHA, package/version/tag list, changelog migrations,
   tarball checksums, notices, check results and registry baseline. Approve the
   waiting `npm-publish` environment job only for that exact candidate.
4. Publication downloads the candidate job's artifact **ID**, verifies its receipt
   and bytes against the same source SHA, queries a fresh registry plan and rejects
   changed publication membership, then runs the pinned Changesets publish
   Action with `publish --from-pack-dir`. No version command, prepack or rebuild
   follows verification. The Action creates tags for confirmed publications;
   its built-in GitHub Release creation is disabled.
5. The announcement step accepts only confirmed package/version results from that
   action, verifies each remote tag resolves to the candidate commit, and creates
   its GitHub Release from the corresponding changelog section. Partial npm success
   can produce some announcements even though the publication job ultimately fails.

## Artifact checks

Changesets 3.0.1 supports `pack --from-publish-plan <file> --out-dir <directory>`
and `publish --from-pack-dir <directory>`. This lets verification and publication
use identical tarballs. Build before packing, then set
`npm_config_ignore_scripts=true` for packing to avoid another build. Publication
is an external write, never a local verification command.

`node scripts/release-artifacts.cjs inspect <directory>` validates the packed
plan against current public workspaces, exact versions and manifests, per-package
changelog entries, tarball hashes and paths. Stable releases require `latest`;
prereleases require their named channel, such as `beta` for `2.0.0-beta.0`.
Changesets' first-prerelease `latest` exception is intentionally rejected. CLI
3.0.1 `publish-plan` has no tag override: this workflow supports prereleases after
an established stable release. A first-publication prerelease needs a separately
reviewed maintained-tool solution; do not silently publish it to `latest`. Empty plans,
private/root packages, duplicate packages and tag-only entries are rejected.

After required checks and exact-tarball MCP tests pass, `seal <directory> <sha>`
writes a new verification receipt. `verify <directory> <sha>` checks the commit,
plan hash and tarballs again. The receipt is a checksum record; it does not prove
tests ran and is not signed npm provenance. CI ordering and protected artifact
transfer must establish that relationship. Do not replace an existing receipt or
rebuild/version packages after verification.

The offline publication fixtures run the installed CLI against a fake npm
executable in disposable local repositories. They establish that a later registry
failure leaves earlier successful publications intact. They also reproduce a
CLI 3.0.1 limitation: a failed local tag operation can still emit a tag event and
exit successfully. The pinned Action 2.1.1 likewise catches a remote tag-creation
error as a warning. Neither an event nor a successful command alone proves that a
remote tag exists at the intended commit. The CI announcement step must verify
the remote tag target explicitly before creating a package GitHub Release.
Registry state remains authoritative after failures; do not blindly rerun
publication or assume npm publication and GitHub announcements are atomic.

## Failure recovery

Keep the run URL, source commit, artifact ID/receipt, plan and registry responses.
Artifacts expire after 30 days; retain the verified bytes before expiry when
investigating. A prepared changelog, passed check, or tag event does not prove a
version was published. Distinguish **prepared** source, **published** npm bytes,
and **announced** GitHub releases throughout reconciliation.

- Failed checks, missing setup or denied approval: publish has not started. Fix the
  source/setup and produce a new candidate; do not bypass failed checks or approval.
- Registry rejection or partial publication: inspect each selected name/version
  with `npm view <name>@<version> version dist.integrity gitHead --json` and compare
  the registry artifact to the retained verified tarball. Registry integrity can
  use a different digest algorithm from the receipt; calculate that algorithm over
  the original bytes, or compare downloaded public tarball hashes. Missing `gitHead`
  is not proof of source identity; retain the run/receipt and verify provenance when
  present. Never republish an existing name/version or assume a timeout means failure.
- For still-unpublished packages, repair the cause and request a new approved run
  at the same source commit if it remains the branch tip. Otherwise prepare and
  review a new candidate without rewriting the branch; include any newly required
  version changes. Its fresh maintained publish-plan excludes existing
  versions. Recheck the registry before approval, compare new artifact hashes to
  retained bytes, and stop on unexplained differences. Do not rerun only the failed
  publish job: it would reuse a stale plan. Dependency publication is not atomic.
- Tag rejection or wrong existing target after npm success: stop announcements.
  Inspect existing refs and confirm the published bytes/source. Separately approve
  creation of a missing tag at the verified source SHA. Never move an existing tag
  or rewrite shared history to disguise a mismatch.
- GitHub Release failure after npm success: inspect which tags/releases already
  exist. Once identity is reconciled, separately authorize creation of only missing
  release statements from the matching changelog sections, using the verified tag
  and source SHA. Do not run npm publish again to obtain announcement events. A new
  publish plan correctly omits existing versions and therefore will not repair
  their missing GitHub releases automatically.

No hosted workflow, OIDC exchange, approval enforcement, registry publication or
GitHub mutation was exercised by local fixture validation. Activation must verify
those integrations and the actual remote settings under separate authorization.

## Sources

Verified against pinned CLI 3.0.1 and its installed behavior, with official
[configuration](https://changesets.dev/guide/config),
[CLI commands](https://changesets.dev/guide/cli),
[npm lockfile-only installation](https://docs.npmjs.com/cli/v11/commands/npm-install/)
and [npm lifecycle](https://docs.npmjs.com/cli/v11/using-npm/scripts/) documentation.
Hosted definitions use the released
[Changesets Action v2.1.1](https://github.com/changesets/action/tree/v2.1.1),
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) and
[GitHub environment API](https://docs.github.com/en/rest/deployments/environments).
