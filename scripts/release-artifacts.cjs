const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const {
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} = require("node:fs");
const { resolve } = require("node:path");
const { isDeepStrictEqual } = require("node:util");
const { readPackages } = require("./packages.cjs");

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const integrity = (path) =>
  `sha256-${createHash("sha256").update(readFileSync(path)).digest("base64")}`;

// This validates a maintained Changesets pack output. It never calculates
// versions, builds packages, publishes, creates tags, or calls a remote service.
function readPackedReleases(root, bundle) {
  root = realpathSync(root);
  bundle = realpathSync(bundle);
  if (readJson(resolve(root, "package.json")).private !== true)
    throw new Error("Release root must remain private");
  const document = readJson(resolve(bundle, "publish-plan.json"));
  if (
    document?.version !== 1 ||
    !Array.isArray(document.plan) ||
    !document.plan.every(Array.isArray)
  )
    throw new Error("Invalid Changesets packed plan");
  const releases = document.plan.flat();
  if (!releases.length) throw new Error("Release plan is empty");
  const packages = new Map(
    readPackages(root).map((pkg) => [pkg.manifest.name, pkg])
  );
  const names = new Set();
  const paths = new Set();
  for (const release of releases) {
    if (release?.kind !== "publish")
      throw new Error("Only publish entries are allowed");
    const pkg = packages.get(release.name);
    if (!pkg || pkg.manifest.private)
      throw new Error("Plan package must be a public workspace");
    if (names.has(release.name))
      throw new Error("Release plan contains a duplicate package");
    names.add(release.name);
    if (release.version !== pkg.manifest.version)
      throw new Error("Plan version differs from workspace version");
    if (release.access !== "public")
      throw new Error("Release access must be public");
    // Stable releases use latest; prereleases use their named channel (beta,
    // next, rc, etc.). Numeric-only channels and a prerelease latest are refused.
    const withoutBuild = release.version.split("+")[0];
    const separator = withoutBuild.indexOf("-");
    const pre = separator < 0 ? undefined : withoutBuild.slice(separator + 1);
    const channel = pre ? pre.split(".")[0] : "latest";
    if (
      !/^[a-z][a-z0-9-]*$/.test(channel) ||
      (pre && channel === "latest") ||
      release.tag !== channel
    )
      throw new Error("Release dist-tag does not match version channel");
    const path = release.tarball?.path;
    if (
      typeof path !== "string" ||
      !/^packages\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.tgz$/.test(path)
    )
      throw new Error("Invalid tarball path");
    if (paths.has(path))
      throw new Error("Release plan contains a duplicate tarball path");
    paths.add(path);
    const absolute = resolve(bundle, path);
    if (realpathSync(absolute) !== absolute || !statSync(absolute).isFile())
      throw new Error(
        "Tarball must be a regular file without symlink components"
      );
    if (integrity(absolute) !== release.tarball.integrity)
      throw new Error("Tarball integrity mismatch");
    // Read metadata without extracting any archive paths into the checkout.
    const packed = JSON.parse(
      execFileSync("tar", ["-xOf", absolute, "package/package.json"], {
        encoding: "utf8",
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      })
    );
    if (!isDeepStrictEqual(packed, pkg.manifest))
      throw new Error("Packed manifest differs from workspace manifest");
    const changelog = readFileSync(resolve(pkg.path, "CHANGELOG.md"), "utf8");
    const lines = changelog.split(/\r?\n/);
    const heading = lines.indexOf(`## ${release.version}`);
    const next = lines.findIndex(
      (line, index) => index > heading && /^## /.test(line)
    );
    if (
      heading < 0 ||
      !lines
        .slice(heading + 1, next < 0 ? undefined : next)
        .join("\n")
        .trim()
    )
      throw new Error("Missing package changelog entry for release version");
  }
  return releases;
}

function sourceCommit(sha) {
  if (typeof sha !== "string" || !/^[a-f0-9]{40}$/.test(sha))
    throw new Error("Expected a full source commit SHA");
  return sha;
}

// Call only after the workflow's required checks and exact-tarball smoke tests.
// This is a checksum receipt, not signed provenance or proof those tests ran.
function sealBundle(root, bundle, sha) {
  sourceCommit(sha);
  readPackedReleases(root, bundle);
  writeFileSync(
    resolve(bundle, "verification.json"),
    JSON.stringify(
      {
        version: 1,
        sourceCommit: sha,
        planIntegrity: integrity(resolve(bundle, "publish-plan.json")),
      },
      null,
      2
    ) + "\n",
    { flag: "wx" }
  );
}

function verifyBundle(root, bundle, sha) {
  sourceCommit(sha);
  const receipt = readJson(resolve(bundle, "verification.json"));
  if (receipt?.version !== 1 || receipt.sourceCommit !== sha)
    throw new Error("Verified source commit mismatch");
  if (receipt.planIntegrity !== integrity(resolve(bundle, "publish-plan.json")))
    throw new Error("Verified plan integrity mismatch");
  return readPackedReleases(root, bundle);
}

function verifyRegistryPlan(root, bundle, freshPath) {
  const selected = readPackedReleases(root, bundle);
  const fresh = readJson(freshPath);
  const project = (entries) =>
    entries
      .map(({ kind, name, version, access, tag }) => ({
        kind,
        name,
        version,
        access,
        tag,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  if (
    fresh?.version !== 1 ||
    !Array.isArray(fresh.plan) ||
    !fresh.plan.every(Array.isArray) ||
    !isDeepStrictEqual(project(selected), project(fresh.plan.flat()))
  )
    throw new Error(
      "Registry plan changed since candidate verification; reconcile before publication"
    );
}

if (require.main === module) {
  try {
    const [mode, directory, sha, ...extra] = process.argv.slice(2);
    if (
      !directory ||
      extra.length ||
      !["inspect", "seal", "verify"].includes(mode)
    )
      throw new Error(
        "Usage: release-artifacts.cjs inspect|seal|verify <pack-directory> [source-sha]"
      );
    const root = resolve(__dirname, "..");
    if (mode === "inspect") readPackedReleases(root, resolve(directory));
    else if (mode === "seal") sealBundle(root, resolve(directory), sha);
    else verifyBundle(root, resolve(directory), sha);
    process.stdout.write(`Release artifact ${mode} passed.\n`);
  } catch (error) {
    process.stderr.write(`Release artifact check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  readPackedReleases,
  sealBundle,
  verifyBundle,
  verifyRegistryPlan,
};
