import { createRequire } from "node:module";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

const root = resolve(__dirname, "../..");
const require = createRequire(import.meta.url);
// Load the legacy entry points with all external commands forbidden. Importing
// discovery must not run publishing, version changes, or Git commands.
function releaseDiscovery(script: string, directory: string) {
  const module = { exports: {} as { getServers: (root: string) => string[] } };
  const localRequire = createRequire(resolve(root, "scripts", script));
  const guardedRequire = (name: string) => {
    if (["child_process", "node:child_process"].includes(name))
      return {
        execSync: () => {
          throw new Error("External command forbidden");
        },
      };
    return localRequire(name);
  };
  runInNewContext(readFileSync(resolve(root, "scripts", script), "utf8"), {
    require: guardedRequire,
    module,
    __dirname: resolve(root, "scripts"),
    process: { cwd: () => directory, argv: [] },
    console,
  });
  return module.exports.getServers(directory);
}

it.each(["publish.js", "deploy.js"])(
  "%s includes all seven workspace servers without external commands",
  (script) => {
    expect(releaseDiscovery(script, root)).toEqual([
      "aijobsearch",
      "canvas",
      "clickup",
      "elasticsearch",
      "flight",
      "postgresql",
      "salesforce",
    ]);
  }
);

it("build, catalog and both release scripts follow explicit workspace selection", async () => {
  mkdirSync(resolve(root, "dist/test-artifacts"), { recursive: true });
  const scratch = mkdtempSync(resolve(root, "dist/test-artifacts/discovery-"));
  try {
    writeFileSync(
      resolve(scratch, "package.json"),
      JSON.stringify({ author: "Fixture", workspaces: ["servers/included"] })
    );
    mkdirSync(resolve(scratch, "servers/excluded"), { recursive: true });
    mkdirSync(resolve(scratch, "servers/included/src"), { recursive: true });
    mkdirSync(resolve(scratch, "servers/included/dist"));
    writeFileSync(
      resolve(scratch, "servers/included/package.json"),
      JSON.stringify({
        name: "@fixture/included",
        version: "1.0.0",
        author: "Fixture",
        type: "module",
        main: "dist/index.js",
        bin: { included: "dist/index.js" },
        mcpSuite: {
          displayName: "Included",
          toolInventory: { module: "dist/index.js", export: "tools" },
          environment: { required: [], optional: [], notes: "Fixture" },
        },
      })
    );
    writeFileSync(
      resolve(scratch, "servers/included/dist/index.js"),
      'export const tools = [{name:"read"}];'
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      require("../../scripts/build.js").main(["--list"], { root: scratch });
      expect(log).toHaveBeenCalledWith(JSON.stringify(["included"]));
    } finally {
      log.mockRestore();
    }
    const catalog = await require("../../scripts/catalog.cjs").loadCatalog(
      scratch
    );
    expect(
      catalog.servers.map((server: { name: string }) => server.name)
    ).toEqual(["included"]);
    for (const script of ["publish.js", "deploy.js"])
      expect(releaseDiscovery(script, scratch)).toEqual(["included"]);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
