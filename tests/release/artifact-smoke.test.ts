import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { expect, it } from "vitest";

const project = resolve(__dirname, "../..");
it("runs the actual packaged MCP checks for a supplied release subset without repacking", () => {
  mkdirSync(resolve(project, "dist/test-artifacts"), { recursive: true });
  const fixture = mkdtempSync(
    resolve(project, "dist/test-artifacts/artifact-smoke-")
  );
  const run = (
    program: string,
    args: string[],
    cwd = project,
    env = process.env
  ) =>
    execFileSync(program, args, {
      cwd,
      env,
      encoding: "utf8",
      timeout: 120000,
      stdio: ["ignore", "pipe", "pipe"],
    });
  try {
    for (const file of [
      "package.json",
      "package-lock.json",
      "config/servers.json",
      "scripts/packages.cjs",
      "scripts/release-artifacts.cjs",
      "tests/packaging/packages.test.ts",
      "tests/fixtures/offline-process.cjs",
      "tests/fixtures/start-package.cjs",
      "tests/fixtures/install-package.ts",
      "tests/fixtures/packaged-transport.ts",
      "tests/fixtures/package-success-contracts.ts",
      "tests/fixtures/package-provider-responses.mjs",
      "tests/fixtures/package-failure-contracts.ts",
      "tests/fixtures/package-isolation.cjs",
      "tests/fixtures/package-isolation.mjs",
    ]) {
      mkdirSync(dirname(resolve(fixture, file)), { recursive: true });
      copyFileSync(resolve(project, file), resolve(fixture, file));
    }
    const packages = require("../../scripts/packages.cjs").readPackages(
      project
    );
    for (const pkg of packages) {
      mkdirSync(resolve(fixture, pkg.directory), { recursive: true });
      copyFileSync(
        resolve(pkg.path, "package.json"),
        resolve(fixture, pkg.directory, "package.json")
      );
      writeFileSync(
        resolve(fixture, pkg.directory, "CHANGELOG.md"),
        `# Fixture\n\n## ${pkg.manifest.version}\n\nSynthetic candidate notes.\n`
      );
    }
    symlinkSync(
      resolve(project, "node_modules"),
      resolve(fixture, "node_modules"),
      "dir"
    );
    const bundle = resolve(fixture, "bundle");
    mkdirSync(resolve(bundle, "packages"), { recursive: true });
    run("npm", ["run", "build", "--", "--server=postgresql"]);
    const [packed] = JSON.parse(
      run("npm", [
        "pack",
        "--workspace",
        "servers/postgresql",
        "--ignore-scripts",
        "--json",
        "--pack-destination",
        resolve(bundle, "packages"),
      ])
    );
    const tarball = resolve(bundle, "packages", packed.filename);
    const digest = createHash("sha256")
      .update(readFileSync(tarball))
      .digest("base64");
    writeFileSync(
      resolve(bundle, "publish-plan.json"),
      JSON.stringify({
        version: 1,
        plan: [
          [
            {
              kind: "publish",
              name: packed.name,
              version: packed.version,
              access: "public",
              tag: "latest",
              tarball: {
                path: `packages/${packed.filename}`,
                integrity: `sha256-${digest}`,
              },
            },
          ],
        ],
      })
    );
    // This fixture has no source/build configuration. Any accidental prepack
    // would fail; only the previously packed tarball can provide the server.
    const output = run(
      process.execPath,
      [
        resolve(project, "node_modules/vitest/vitest.mjs"),
        "run",
        "--root",
        fixture,
        "--config",
        resolve(project, "vitest.config.ts"),
        "tests/packaging/packages.test.ts",
      ],
      fixture,
      { ...process.env, MCP_RELEASE_PACK_DIR: bundle }
    );
    expect(output).toMatch(/4 passed/);
    expect(
      createHash("sha256").update(readFileSync(tarball)).digest("base64")
    ).toBe(digest);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}, 180000);
