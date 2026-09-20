# Package release review

Follow [the release guide](../docs/releasing.md). Each package's `CHANGELOG.md`
is the source of its release statement; do not create a parallel payload under
`releases/` or infer notes from the clean-slate commit.

- Review affected packages, version bumps and breaking-change migrations.
- Verify synchronized manifests, root lockfile and generated catalog.
- Verify the exact package artifacts and their source commit.
- Resolve registry ownership, applicable license notices and activation prerequisites.
- Obtain publication authorization separately from version preparation.
- Announce only confirmed published versions using `<package-name>@<version>` tags.

Publication/announcement automation is a separate implementation step; this
checklist does not authorize external writes.
