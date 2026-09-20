import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const require = createRequire(import.meta.url);
it("Changesets discovers the same seven workspace packages as build and catalog", () => {
  mkdirSync(resolve(root, "dist/test-artifacts"), { recursive: true });
  const scratch = mkdtempSync(
    resolve(root, "dist/test-artifacts/release-discovery-")
  );
  const run = (program: string, args: string[]) =>
    execFileSync(program, args, {
      cwd: scratch,
      encoding: "utf8",
      timeout: 10000,
    });
  try {
    const packages = require("../../scripts/packages.cjs").readPackages(root);
    const manifest = JSON.parse(
      readFileSync(resolve(root, "package.json"), "utf8")
    );
    const config = JSON.parse(
      readFileSync(resolve(root, ".changeset/config.json"), "utf8")
    );
    writeFileSync(
      resolve(scratch, "package.json"),
      JSON.stringify({
        name: "fixture-root",
        private: true,
        version: "1.0.0",
        workspaces: manifest.workspaces,
      })
    );
    // Manypkg uses a lockfile to identify this npm workspace root. Without one
    // it can select the parent checkout and accidentally inspect its Changesets.
    writeFileSync(
      resolve(scratch, "package-lock.json"),
      JSON.stringify({
        name: "fixture-root",
        version: "1.0.0",
        lockfileVersion: 3,
        packages: {},
      })
    );
    mkdirSync(resolve(scratch, ".changeset"));
    writeFileSync(
      resolve(scratch, ".changeset/config.json"),
      JSON.stringify(config)
    );
    for (const pkg of packages) {
      mkdirSync(resolve(scratch, pkg.directory), { recursive: true });
      writeFileSync(
        resolve(scratch, pkg.directory, "package.json"),
        JSON.stringify(pkg.manifest)
      );
    }
    run("git", ["init", "--quiet", "-b", config.baseBranch]);
    run("git", ["add", "."]);
    run("git", [
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "chore(fixture): baseline",
    ]);
    // Synthetic changesets make this test independent of actual pending releases.
    writeFileSync(
      resolve(scratch, ".changeset/bundled-consumers.md"),
      `---\n${packages.map((pkg: { manifest: { name: string } }) => `"${pkg.manifest.name}": patch`).join("\n")}\n---\n\nFix a shared bundled helper.\n`
    );
    const output = resolve(scratch, "status.json");
    run(process.execPath, [
      resolve(root, "node_modules/@changesets/cli/bin.js"),
      "status",
      "--output",
      output,
    ]);
    const plan = JSON.parse(readFileSync(output, "utf8"));
    expect(plan.changesets.map((entry: { id: string }) => entry.id)).toEqual([
      "bundled-consumers",
    ]);
    expect(packages).toHaveLength(7);
    const names = packages
      .map((pkg: { manifest: { name: string } }) => pkg.manifest.name)
      .sort();
    expect(
      plan.releases.map((release: { name: string }) => release.name).sort()
    ).toEqual(names);
    const catalog = JSON.parse(
      readFileSync(resolve(root, "config/servers.json"), "utf8")
    );
    expect(
      catalog.servers
        .map((server: { package: string }) => server.package)
        .sort()
    ).toEqual(names);
    const builtNames = JSON.parse(
      execFileSync(
        process.execPath,
        [resolve(root, "scripts/build.js"), "--list"],
        { cwd: scratch, encoding: "utf8" }
      )
    );
    expect(builtNames).toEqual(
      packages.map((pkg: { server: string }) => pkg.server)
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
