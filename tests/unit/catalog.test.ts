import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { expect, it } from "vitest";
const require = createRequire(import.meta.url);
const {
  validateMetadata,
  renderCatalog,
  loadCatalog,
  sourceEnvironment,
  main,
} = require("../../scripts/catalog.cjs");
const root = resolve(__dirname, "../..");
const { readPackages } = require("../../scripts/packages.cjs");
it("requires complete metadata on every discovered workspace", () => {
  for (const pkg of readPackages(root))
    expect(() => validateMetadata(pkg)).not.toThrow();
});
it.each([
  {},
  {
    displayName: "Fixture",
    toolInventory: { module: "../outside.js", export: "tools" },
    environment: { required: [], optional: [], notes: "Fixture" },
  },
  {
    displayName: "Fixture",
    toolInventory: { module: "dist/tools.js", export: "tools" },
    environment: { required: ["TOKEN"], optional: ["TOKEN"], notes: "Fixture" },
  },
])("rejects incomplete/unsafe/ambiguous metadata", (mcpSuite) => {
  expect(() =>
    validateMetadata({ server: "fixture", manifest: { mcpSuite } })
  ).toThrow();
});
it("renders counts and paths from the supplied inventory", () => {
  const catalog = {
    servers: [
      {
        name: "fixture",
        displayName: "Fixture",
        package: "@fixture/test",
        version: "1.2.3",
        entry: "servers/fixture/dist/server.js",
        tools: ["read", "write"],
        toolCount: 2,
        environment: {
          required: ["TOKEN"],
          optional: [],
          notes: "Synthetic setup",
        },
      },
    ],
  };
  const rendered = renderCatalog(catalog);
  expect(rendered).toContain("@fixture/test");
  expect(rendered).toContain("2");
  expect(rendered).toContain("servers/fixture/dist/server.js");
  expect(rendered).toContain("TOKEN");
});

async function fixture(
  run: (root: string, pkg: Record<string, any>) => Promise<void>
) {
  mkdirSync(resolve(root, "dist/test-artifacts"), { recursive: true });
  const scratch = mkdtempSync(resolve(root, "dist/test-artifacts/catalog-"));
  const path = resolve(scratch, "servers/fixture");
  mkdirSync(resolve(path, "src"), { recursive: true });
  mkdirSync(resolve(path, "dist"));
  const pkg = {
    name: "@fixture/server",
    author: "Fixture",
    version: "1.0.0",
    type: "module",
    main: "dist/tools.js",
    bin: { fixture: "dist/tools.js" },
    mcpSuite: {
      displayName: "Fixture",
      toolInventory: { module: "dist/tools.js", export: "tools" },
      environment: {
        required: ["FIXTURE_TOKEN"],
        optional: [],
        notes: "Fixture only",
      },
    },
  };
  writeFileSync(
    resolve(scratch, "package.json"),
    JSON.stringify({ author: "Fixture", workspaces: ["servers/*"] })
  );
  writeFileSync(resolve(path, "package.json"), JSON.stringify(pkg));
  writeFileSync(resolve(path, "src/index.ts"), 'getEnvVar("FIXTURE_TOKEN");');
  writeFileSync(
    resolve(path, "dist/tools.js"),
    'export const tools=[{name:"read"},{name:"write"}];'
  );
  try {
    await run(scratch, pkg);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
it("derives discovery from workspace metadata and actual exports", async () =>
  fixture(async (root) => {
    const result = await loadCatalog(root);
    expect(result.servers).toHaveLength(1);
    expect(result.servers[0]).toMatchObject({
      toolCount: 2,
      tools: ["read", "write"],
      entry: "servers/fixture/dist/tools.js",
    });
  }));
it.each(["environment", "author", "binary", "duplicate"])(
  "rejects %s drift",
  async (kind) =>
    fixture(async (root, pkg) => {
      const path = resolve(root, "servers/fixture");
      if (kind === "environment")
        pkg.mcpSuite.environment.optional.push("UNREAD_SETTING");
      if (kind === "author") pkg.author = "Different";
      if (kind === "binary") pkg.bin.fixture = "dist/absent.js";
      if (kind === "duplicate")
        writeFileSync(
          resolve(path, "dist/tools.js"),
          'export const tools=[{name:"read"},{name:"read"}];'
        );
      writeFileSync(resolve(path, "package.json"), JSON.stringify(pkg));
      await expect(loadCatalog(root)).rejects.toThrow();
    })
);
it("recognizes literal helper/direct environment readers and shared log setting", async () =>
  fixture(async (root) => {
    const src = resolve(root, "servers/fixture/src");
    writeFileSync(
      resolve(src, "index.ts"),
      'getHttpUrlEnvVar("BASE_URL"); getIntegerEnvVar("LIMIT", {}); process.env.TOKEN; getLogLevel();'
    );
    expect(sourceEnvironment(src)).toEqual([
      "BASE_URL",
      "LIMIT",
      "LOG_LEVEL",
      "TOKEN",
    ]);
  }));
it("rejects invalid command arguments before building", async () => {
  await expect(main(["--unexpected"])).rejects.toThrow("Usage:");
});
