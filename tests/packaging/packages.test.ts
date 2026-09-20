import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const packages: Array<{
  path: string;
  server: string;
  manifest: { name: string; main: string; bin: Record<string, string> };
}> = require("../../scripts/packages.cjs").readPackages(root);
mkdirSync(resolve(root, "dist/test-artifacts"), { recursive: true });
const scratch = mkdtempSync(resolve(root, "dist/test-artifacts/packages-"));
const env = {
  LOG_LEVEL: "error",
  AIJOBSEARCH_API_TOKEN: "fixture-token",
  AIJOBSEARCH_API_URL: "https://fixture.invalid",
  CANVAS_API_TOKEN: "fixture-token",
  CANVAS_BASE_URL: "https://fixture.invalid",
  CLICKUP_API_TOKEN: "fixture-token",
  DUFFEL_API_KEY: "fixture-token",
  POSTGRESQL_CONNECTION_STRING:
    "postgresql://fixture:fixture@127.0.0.1:1/fixture",
  SALESFORCE_INSTANCE_URL: "https://fixture.invalid",
  SALESFORCE_ACCESS_TOKEN: "fixture-token",
  ELASTICSEARCH_NODE: "http://127.0.0.1:1",
};

beforeAll(() => {
  // Real prepack hooks build current source. No publish/version/tag commands.
  const packed = JSON.parse(
    execFileSync(
      "npm",
      ["pack", "--workspaces", "--json", "--pack-destination", scratch],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 120000,
        stdio: ["ignore", "pipe", "pipe"],
      }
    )
  );
  expect(packed).toHaveLength(7);
  const dependencies: Record<string, string> = {};
  // Reuse the exact lock graph and tarball integrities. An unpinned npm install
  // would require registry metadata even after npm ci cached all tarballs.
  const lock = JSON.parse(
    readFileSync(resolve(root, "package-lock.json"), "utf8")
  );
  const original = structuredClone(lock.packages);
  for (const tarball of packed) {
    const pkg = packages.find((item) => item.manifest.name === tarball.name)!;
    expect(pkg).toBeDefined();
    const files = tarball.files.map((file: { path: string }) => file.path);
    for (const entry of [pkg.manifest.main, ...Object.values(pkg.manifest.bin)])
      expect(files).toContain(entry);
    expect(files).toContain("dist/shared/utils/logger.js");
    expect(
      files.some(
        (path: string) =>
          path.startsWith("src/") || path.includes("node_modules/")
      )
    ).toBe(false);
    dependencies[tarball.name] = `file:${resolve(scratch, tarball.filename)}`;
    const workspacePath = `servers/${pkg.server}`;
    const installedPath = `node_modules/${tarball.name}`;
    lock.packages[installedPath] = {
      ...original[workspacePath],
      resolved: dependencies[tarball.name],
      integrity: tarball.integrity,
    };
    delete lock.packages[installedPath].devDependencies;
    delete lock.packages[workspacePath];
    for (const [path, value] of Object.entries(original)) {
      if (path.startsWith(`${workspacePath}/node_modules/`)) {
        lock.packages[installedPath + path.slice(workspacePath.length)] = value;
        delete lock.packages[path];
      }
    }
  }
  writeFileSync(
    resolve(scratch, "package.json"),
    JSON.stringify({
      private: true,
      name: "package-fixture",
      version: "1.0.0",
      dependencies,
    })
  );
  lock.name = "package-fixture";
  lock.version = "1.0.0";
  lock.packages[""] = { name: lock.name, version: lock.version, dependencies };
  writeFileSync(resolve(scratch, "package-lock.json"), JSON.stringify(lock));
  // npm ci validates this graph and installs without any registry requests.
  execFileSync(
    "npm",
    ["ci", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"],
    {
      cwd: scratch,
      timeout: 60000,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
}, 180000);

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

for (const pkg of packages) {
  it(`${pkg.server} initializes and lists tools from its installed tarball`, async () => {
    const installed = resolve(scratch, "node_modules", pkg.manifest.name);
    const manifest = JSON.parse(
      readFileSync(resolve(installed, "package.json"), "utf8")
    );
    const entry = resolve(installed, manifest.main);
    expect(existsSync(entry)).toBe(true);
    const client = new Client(
      { name: "package-fixture", version: "1.0.0" },
      { capabilities: {} }
    );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        "--require",
        resolve(root, "tests/fixtures/offline-process.cjs"),
        resolve(root, "tests/fixtures/start-package.cjs"),
        scratch,
        entry,
      ],
      env,
      stderr: "ignore",
    });
    try {
      await client.connect(transport);
      const result = await client.listTools();
      expect(result.tools.length).toBeGreaterThan(0);
      expect(new Set(result.tools.map((tool) => tool.name)).size).toBe(
        result.tools.length
      );
    } finally {
      await client.close();
      await transport.close();
    }
  }, 15000);
}
