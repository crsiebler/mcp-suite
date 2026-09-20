import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const project = resolve(__dirname, "../..");
const sha = "a".repeat(40);
let root: string;
let bundle: string;
let entry: {
  kind: string;
  name: string;
  version: string;
  access: string;
  tag: string;
  tarball: { path: string; integrity: string };
};
const json = (path: string, value: unknown) =>
  writeFileSync(path, JSON.stringify(value));
const digest = (path: string) =>
  `sha256-${createHash("sha256").update(readFileSync(path)).digest("base64")}`;
const savePlan = (entries = [entry]) =>
  json(resolve(bundle, "publish-plan.json"), { version: 1, plan: [entries] });
const api = () => require("../../scripts/release-artifacts.cjs");

beforeEach(() => {
  mkdirSync(resolve(project, "dist/test-artifacts"), { recursive: true });
  root = mkdtempSync(
    resolve(project, "dist/test-artifacts/release-artifacts-")
  );
  bundle = resolve(root, "bundle");
  mkdirSync(resolve(bundle, "packages"), { recursive: true });
  mkdirSync(resolve(root, "servers/example"), { recursive: true });
  mkdirSync(resolve(root, "packed/package"), { recursive: true });
  json(resolve(root, "package.json"), {
    name: "private-root",
    private: true,
    workspaces: ["servers/*"],
  });
  const manifest = {
    name: "@fixture/example",
    version: "1.2.0",
    main: "dist/index.js",
  };
  json(resolve(root, "servers/example/package.json"), manifest);
  json(resolve(root, "packed/package/package.json"), manifest);
  writeFileSync(
    resolve(root, "servers/example/CHANGELOG.md"),
    "# Example\n\n## 1.2.0\n\nVerified changes.\n"
  );
  const path = "packages/fixture-example-1.2.0.tgz";
  execFileSync(
    "tar",
    ["-czf", resolve(bundle, path), "-C", resolve(root, "packed"), "package"],
    { timeout: 10000 }
  );
  entry = {
    kind: "publish",
    name: manifest.name,
    version: manifest.version,
    access: "public",
    tag: "latest",
    tarball: { path, integrity: digest(resolve(bundle, path)) },
  };
  savePlan();
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

it("validates only planned workspaces and seals the source commit and exact plan", () => {
  expect(
    api()
      .readPackedReleases(root, bundle)
      .map((item: { name: string }) => item.name)
  ).toEqual([entry.name]);
  api().sealBundle(root, bundle, sha);
  expect(api().verifyBundle(root, bundle, sha)).toHaveLength(1);
  expect(() => api().verifyBundle(root, bundle, "b".repeat(40))).toThrow(
    /source commit/
  );
});

it("detects tarball changes and plan changes after verification", () => {
  api().sealBundle(root, bundle, sha);
  writeFileSync(resolve(bundle, entry.tarball.path), "changed bytes");
  expect(() => api().verifyBundle(root, bundle, sha)).toThrow(/integrity/);
  entry.tarball.integrity = digest(resolve(bundle, entry.tarball.path));
  savePlan();
  expect(() => api().verifyBundle(root, bundle, sha)).toThrow(/plan/);
});

it("refuses a stale approved plan when registry membership changed", () => {
  const path = resolve(root, "fresh-plan.json");
  const { tarball: _unused, ...release } = entry;
  json(path, { version: 1, plan: [[release]] });
  expect(() => api().verifyRegistryPlan(root, bundle, path)).not.toThrow();
  json(path, { version: 1, plan: [] });
  expect(() => api().verifyRegistryPlan(root, bundle, path)).toThrow(
    /Registry plan changed/
  );
  json(path, { version: 1, plan: [[{ ...release, version: "2.0.0" }]] });
  expect(() => api().verifyRegistryPlan(root, bundle, path)).toThrow(
    /Registry plan changed/
  );
});

it.each(["private-root", "@fixture/unknown"])(
  "rejects unowned plan package %s",
  (name) => {
    entry.name = name;
    savePlan();
    expect(() => api().readPackedReleases(root, bundle)).toThrow(/workspace/);
  }
);

it("rejects duplicate entries, empty plans and tag-only operations", () => {
  savePlan([entry, entry]);
  expect(() => api().readPackedReleases(root, bundle)).toThrow(/duplicate/);
  savePlan([]);
  expect(() => api().readPackedReleases(root, bundle)).toThrow(/empty/);
  entry.kind = "tag-only";
  savePlan();
  expect(() => api().readPackedReleases(root, bundle)).toThrow(/publish/);
});

it("rejects version, manifest and changelog disagreement", () => {
  entry.version = "2.0.0";
  savePlan();
  expect(() => api().readPackedReleases(root, bundle)).toThrow(/version/);
  entry.version = "1.2.0";
  savePlan();
  json(resolve(root, "servers/example/package.json"), {
    name: entry.name,
    version: entry.version,
    main: "other.js",
  });
  expect(() => api().readPackedReleases(root, bundle)).toThrow(/manifest/);
  json(resolve(root, "servers/example/package.json"), {
    name: entry.name,
    version: entry.version,
    main: "dist/index.js",
  });
  writeFileSync(
    resolve(root, "servers/example/CHANGELOG.md"),
    "# Example\n\n## 1.1.0\n\nOlder changes.\n"
  );
  expect(() => api().readPackedReleases(root, bundle)).toThrow(/changelog/);
});

it("rejects private workspaces and nonpublic publication", () => {
  entry.access = "restricted";
  savePlan();
  expect(() => api().readPackedReleases(root, bundle)).toThrow(/public/);
  entry.access = "public";
  savePlan();
  json(resolve(root, "servers/example/package.json"), {
    name: entry.name,
    version: entry.version,
    private: true,
  });
  expect(() => api().readPackedReleases(root, bundle)).toThrow(/workspace/);
});

it("rejects traversal and symlink tarballs", () => {
  entry.tarball.path = "../outside.tgz";
  savePlan();
  expect(() => api().readPackedReleases(root, bundle)).toThrow(/tarball path/);
  symlinkSync(
    resolve(bundle, "packages/fixture-example-1.2.0.tgz"),
    resolve(bundle, "packages/link.tgz")
  );
  entry.tarball.path = "packages/link.tgz";
  savePlan();
  expect(() => api().readPackedReleases(root, bundle)).toThrow(/symlink/);
});

it("uses latest only for stable releases and the prerelease identifier otherwise", () => {
  entry.tag = "beta";
  savePlan();
  expect(() => api().readPackedReleases(root, bundle)).toThrow(/dist-tag/);
  const manifest = {
    name: entry.name,
    version: "2.0.0-beta.0",
    main: "dist/index.js",
  };
  json(resolve(root, "servers/example/package.json"), manifest);
  json(resolve(root, "packed/package/package.json"), manifest);
  writeFileSync(
    resolve(root, "servers/example/CHANGELOG.md"),
    "## 2.0.0-beta.0\n\nPreview.\n"
  );
  execFileSync("tar", [
    "-czf",
    resolve(bundle, entry.tarball.path),
    "-C",
    resolve(root, "packed"),
    "package",
  ]);
  entry.version = manifest.version;
  entry.tarball.integrity = digest(resolve(bundle, entry.tarball.path));
  savePlan();
  expect(api().readPackedReleases(root, bundle)).toHaveLength(1);
  entry.tag = "latest";
  savePlan();
  expect(() => api().readPackedReleases(root, bundle)).toThrow(/dist-tag/);
});

it("accepts actual installed Changesets pack output without rebuilding", () => {
  execFileSync("git", ["init", "--quiet", "-b", "fixture"], { cwd: root });
  execFileSync(
    "npm",
    [
      "install",
      "--package-lock-only",
      "--ignore-scripts",
      "--offline",
      "--no-audit",
      "--no-fund",
    ],
    { cwd: root, timeout: 20000 }
  );
  mkdirSync(resolve(root, ".changeset"));
  json(resolve(root, ".changeset/config.json"), {
    ...JSON.parse(
      readFileSync(resolve(project, ".changeset/config.json"), "utf8")
    ),
    baseBranch: "fixture",
  });
  // A failing prepack proves this path packs the already-built candidate.
  const manifestPath = resolve(root, "servers/example/package.json");
  json(manifestPath, {
    ...JSON.parse(readFileSync(manifestPath, "utf8")),
    scripts: { prepack: "node -e 'process.exit(99)'" },
  });
  const { tarball: _unused, ...unpacked } = entry;
  json(resolve(root, "input-plan.json"), { version: 1, plan: [[unpacked]] });
  const packed = resolve(root, "cli-packed");
  execFileSync(
    process.execPath,
    [
      resolve(project, "node_modules/@changesets/cli/bin.js"),
      "pack",
      "--from-publish-plan",
      resolve(root, "input-plan.json"),
      "--out-dir",
      packed,
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 20000,
      env: {
        ...process.env,
        npm_config_ignore_scripts: "true",
        npm_config_offline: "true",
      },
    }
  );
  expect(api().readPackedReleases(root, packed)).toHaveLength(1);
  api().sealBundle(root, packed, sha);
  expect(api().verifyBundle(root, packed, sha)[0].name).toBe(entry.name);
  expect(() => api().sealBundle(root, packed, sha)).toThrow(/EEXIST/);
});
