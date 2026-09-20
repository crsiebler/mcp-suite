import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";

const project = resolve(__dirname, "../..");
let root: string;
const write = (path: string, value: unknown) =>
  writeFileSync(path, JSON.stringify(value));
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

beforeEach(() => {
  mkdirSync(resolve(project, "dist/test-artifacts"), { recursive: true });
  root = mkdtempSync(resolve(project, "dist/test-artifacts/publish-fixture-"));
  mkdirSync(resolve(root, ".changeset"));
  mkdirSync(resolve(root, "fake-bin"));
  mkdirSync(resolve(root, "bundle/packages"), { recursive: true });
  write(
    resolve(root, ".changeset/config.json"),
    JSON.parse(readFileSync(resolve(project, ".changeset/config.json"), "utf8"))
  );
  write(resolve(root, "package.json"), {
    name: "fixture-root",
    version: "1.0.0",
    private: true,
    workspaces: ["servers/*"],
  });
  const plan = [];
  for (const name of ["alpha", "beta"]) {
    mkdirSync(resolve(root, "servers", name), { recursive: true });
    write(resolve(root, "servers", name, "package.json"), {
      name: `@fixture/${name}`,
      version: "1.0.0",
    });
    // Boundary fake reads these bytes instead of contacting any registry.
    writeFileSync(
      resolve(root, `bundle/packages/${name}.tgz`),
      `verified-${name}`
    );
    plan.push([
      {
        kind: "publish",
        name: `@fixture/${name}`,
        version: "1.0.0",
        access: "public",
        tag: "latest",
        tarball: { path: `packages/${name}.tgz` },
      },
    ]);
  }
  write(resolve(root, "bundle/publish-plan.json"), { version: 1, plan });
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
  git("init", "--quiet", "-b", "fixture");
  git("add", ".");
  git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "chore(fixture): baseline"
  );
  writeFileSync(
    resolve(root, "fake-bin/npm"),
    `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
if(args[0] !== 'publish') { process.stderr.write('Unexpected npm operation'); process.exit(90); }
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const file = path.resolve(args[1]);
const bytes = fs.readFileSync(file, 'utf8');
fs.appendFileSync(process.env.FIXTURE_CALLS, JSON.stringify({name:pkg.name,args,bytes})+'\\n');
const reject = process.env.FIXTURE_REJECT === 'all' || process.env.FIXTURE_REJECT === pkg.name;
if(reject) { process.stdout.write(JSON.stringify({error:{code:'E403',summary:'Fixture registry rejection'}})); process.exit(1); }
process.stdout.write(JSON.stringify({id:pkg.name+'@'+pkg.version}));
`,
    { mode: 0o755 }
  );
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function publish(reject = "", breakTags = false) {
  const output = resolve(root, "report.ndjson");
  const result = spawnSync(
    process.execPath,
    [
      resolve(project, "node_modules/@changesets/cli/bin.js"),
      "publish",
      "--from-pack-dir",
      resolve(root, "bundle"),
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 20000,
      env: {
        PATH: `${resolve(root, "fake-bin")}:${process.env.PATH}`,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
        CI: "true",
        npm_config_offline: "true",
        npm_config_ignore_scripts: "true",
        GIT_AUTHOR_NAME: breakTags ? "" : "Fixture",
        GIT_AUTHOR_EMAIL: breakTags ? "" : "fixture@example.invalid",
        GIT_COMMITTER_NAME: breakTags ? "" : "Fixture",
        GIT_COMMITTER_EMAIL: breakTags ? "" : "fixture@example.invalid",
        CHANGESETS_OUTPUT: output,
        FIXTURE_CALLS: resolve(root, "calls.ndjson"),
        FIXTURE_REJECT: reject,
      },
    }
  );
  expect(result.error).toBeUndefined();
  return {
    status: result.status,
    calls: readFileSync(resolve(root, "calls.ndjson"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line)),
    events: readFileSync(output, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line)),
  };
}

it("publishes exactly supplied artifact bytes and reports tags for confirmed successes", () => {
  const head = git("rev-parse", "HEAD");
  const result = publish();
  expect(result.status).toBe(0);
  expect(result.calls.map((call) => call.bytes)).toEqual([
    "verified-alpha",
    "verified-beta",
  ]);
  for (const call of result.calls)
    expect(call.args.slice(2)).toEqual([
      "--json",
      "--access",
      "public",
      "--tag",
      "latest",
    ]);
  expect(result.events.map((event) => event.tag)).toEqual([
    "@fixture/alpha@1.0.0",
    "@fixture/beta@1.0.0",
  ]);
  for (const event of result.events)
    expect(git("rev-list", "-n", "1", event.tag)).toBe(head);
  expect(git("rev-parse", "HEAD")).toBe(head);
});

it("fails registry rejection without creating an announcement event", () => {
  const result = publish("all");
  expect(result.status).toBe(1);
  expect(result.calls.map((call) => call.name)).toEqual(["@fixture/alpha"]);
  expect(result.events).toEqual([]);
  expect(git("tag", "--list")).toBe("");
});

it("retains successful publication and its event when the next package fails", () => {
  const result = publish("@fixture/beta");
  expect(result.status).toBe(1);
  expect(result.calls).toHaveLength(2);
  expect(result.events).toEqual([
    {
      type: "git-tag",
      tag: "@fixture/alpha@1.0.0",
      packageName: "@fixture/alpha",
    },
  ]);
  expect(git("tag", "--list")).toBe("@fixture/alpha@1.0.0");
});

it("shows why CLI success and tag events do not prove actual tag creation", () => {
  const result = publish("", true);
  // CLI 3.0.1 ignores the false result from @changesets/git.tag. Publication
  // succeeded but no Git tag exists: the workflow must verify remote tags
  // against the source commit before creating any GitHub Release.
  expect(result.status).toBe(0);
  expect(result.calls).toHaveLength(2);
  expect(result.events).toHaveLength(2);
  expect(git("tag", "--list")).toBe("");
});
