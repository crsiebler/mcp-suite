import { once } from "node:events";
import { installPackage } from "../fixtures/install-package.ts";
import { checkFailureContracts } from "../fixtures/package-failure-contracts.ts";
import { checkSuccessContract } from "../fixtures/package-success-contracts.ts";
import { VerifiedStdioTransport } from "../fixtures/packaged-transport.ts";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { execFileSync, spawnSync } from "node:child_process";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { afterAll, beforeAll, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const bundle = process.env.MCP_RELEASE_PACK_DIR;
const releases:
  | Array<{
      name: string;
      tarball: { path: string; integrity: string };
    }>
  | undefined = bundle
  ? require("../../scripts/release-artifacts.cjs").readPackedReleases(
      root,
      bundle
    )
  : undefined;
const packages: Array<{
  path: string;
  server: string;
  manifest: {
    name: string;
    main: string;
    bin: Record<string, string>;
    mcpSuite: { environment: { required: string[] } };
  };
}> = require("../../scripts/packages.cjs")
  .readPackages(root)
  .filter(
    (pkg: { manifest: { name: string } }) =>
      !releases ||
      releases.some((release) => release.name === pkg.manifest.name)
  );
mkdirSync(resolve(root, "dist/test-artifacts"), { recursive: true });
const scratch = mkdtempSync(resolve(root, "dist/test-artifacts/packages-"));
const installDirectory = (server: string) => resolve(scratch, server);
const env = {
  LOG_LEVEL: "debug",
  AI_GATEWAY_API_KEY: "fixture-token",
  CANVAS_API_TOKEN: "fixture-token",
  CANVAS_BASE_URL: "https://fixture.invalid",
  CLICKUP_API_TOKEN: "fixture-token",
  DUFFEL_API_KEY: "fixture-token",
  POSTGRESQL_CONNECTION_STRING:
    "postgresql://fixture:fixture@127.0.0.1:1/fixture",
  SALESFORCE_INSTANCE_URL: "https://fixture.invalid",
  SALESFORCE_ACCESS_TOKEN: "fixture-token",
  ELASTICSEARCH_NODE: "http://127.0.0.1:1",
  ELASTICSEARCH_MAX_RETRIES: "0",
};

beforeAll(() => {
  // CI release mode installs the supplied, already-verified tarballs. Default
  // mode still exercises every real prepack hook against current source.
  const packed = releases
    ? releases.map((release) => ({
        name: release.name,
        filename: resolve(bundle!, release.tarball.path),
        integrity: release.tarball.integrity,
        files: execFileSync(
          "tar",
          ["-tzf", resolve(bundle!, release.tarball.path)],
          {
            encoding: "utf8",
            timeout: 10000,
          }
        )
          .trim()
          .split("\n")
          .map((path) => ({ path: path.replace(/^package\//, "") })),
      }))
    : JSON.parse(
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
  expect(packed).toHaveLength(packages.length);
  if (!releases) expect(packages).toHaveLength(7);
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
    installPackage(root, installDirectory(pkg.server), pkg.server, {
      name: tarball.name,
      path: resolve(scratch, tarball.filename),
      integrity: tarball.integrity,
    });
  }
}, 180000);

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

for (const pkg of packages) {
  it(`${pkg.server} returns a provider fixture success over packaged MCP`, async () => {
    await checkSuccessContract(
      root,
      scratch,
      installDirectory(pkg.server),
      pkg.server,
      resolve(
        installDirectory(pkg.server),
        "node_modules",
        pkg.manifest.name,
        pkg.manifest.main
      ),
      env
    );
  }, 15000);
  it(`${pkg.server} installs without development tools or sibling servers`, () => {
    const modules = resolve(installDirectory(pkg.server), "node_modules");
    expect(existsSync(resolve(modules, "typescript"))).toBe(false);
    expect(existsSync(resolve(modules, "eslint"))).toBe(false);
    for (const other of packages.filter((other) => other.server !== pkg.server))
      expect(existsSync(resolve(modules, other.manifest.name))).toBe(false);
  });
  it(`${pkg.server} keeps debug diagnostics off packaged MCP traffic`, async () => {
    const installed = resolve(
      installDirectory(pkg.server),
      "node_modules",
      pkg.manifest.name
    );
    const manifest = JSON.parse(
      readFileSync(resolve(installed, "package.json"), "utf8")
    );
    const entry = resolve(installed, manifest.main);
    expect(existsSync(entry)).toBe(true);
    const client = new Client(
      { name: "package-fixture", version: "1.0.0" },
      { capabilities: {} }
    );
    const logPath = resolve(scratch, `${pkg.server}.stderr`);
    const stderr = createWriteStream(logPath);
    await once(stderr, "open");
    const transport = new VerifiedStdioTransport({
      command: process.execPath,
      args: [
        "--require",
        resolve(root, "tests/fixtures/offline-process.cjs"),
        "--require",
        resolve(root, "tests/fixtures/package-isolation.cjs"),
        resolve(root, "tests/fixtures/start-package.cjs"),
        scratch,
        entry,
      ],
      env: { ...env, PACKAGE_FIXTURE_ROOT: installDirectory(pkg.server) },
      stderr,
    });
    const protocolErrors: Error[] = [];
    client.onerror = (error) => protocolErrors.push(error);
    try {
      await client.connect(transport);
      const result = await client.listTools();
      expect(result.tools.length).toBeGreaterThan(0);
      expect(new Set(result.tools.map((tool) => tool.name)).size).toBe(
        result.tools.length
      );
      const catalog = JSON.parse(
        readFileSync(resolve(root, "config/servers.json"), "utf8")
      );
      const entry = catalog.servers.find(
        (item: { name: string }) => item.name === pkg.server
      );
      expect(entry).toBeDefined();
      expect(result.tools.map((tool) => tool.name).sort()).toEqual(entry.tools);
      expect(entry.toolCount).toBe(result.tools.length);
      await checkFailureContracts(pkg.server, client, result.tools);
      // Invalid names exercise real dispatch/error handling without provider I/O.
      // SDKs differ between a tool-error result and a JSON-RPC error response.
      const outcome = await client
        .callTool({ name: "fixture_unknown_tool", arguments: {} })
        .then(
          (result) => ({ result, error: undefined }),
          (error: unknown) => ({ result: undefined, error })
        );
      if (outcome.error) {
        expect(outcome.error).toHaveProperty("code");
        expect([-32601, -32602, -32603]).toContain(
          (outcome.error as { code: number }).code
        );
      } else {
        const failure = CallToolResultSchema.parse(outcome.result);
        if (pkg.server === "salesforce") {
          // Salesforce retains its provider-specific envelope.
          const content = failure.content[0];
          expect(content.type).toBe("text");
          if (content.type === "text")
            expect(JSON.parse(content.text)).toMatchObject({ success: false });
        } else {
          expect(failure.isError).toBe(true);
        }
      }
    } finally {
      await client.close();
      await transport.close();
      await new Promise<void>((resolve) => stderr.end(resolve));
    }
    const diagnostics = readFileSync(logPath, "utf8");
    transport.assertProtocolAndExit();
    expect(protocolErrors).toEqual([]);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics).not.toContain("fixture-token");
    expect(diagnostics).not.toContain("postgresql://");
  }, 15000);
}

// Source/catalog checks run before release packing; the artifact pass needs
// only the catalog data to compare with the installed server's actual tools.
it.runIf(!releases)(
  "generated catalog matches the current builds and environment readers",
  async () => {
    await require("../../scripts/catalog.cjs").checkCatalog(root);
  }
);

for (const pkg of packages) {
  for (const key of pkg.manifest.mcpSuite.environment.required as string[]) {
    it(`${pkg.server} metadata-required ${key} actually blocks startup when absent`, () => {
      const environment: NodeJS.ProcessEnv = {
        ...env,
        PACKAGE_FIXTURE_ROOT: installDirectory(pkg.server),
      };
      delete environment[key];
      const entry = resolve(
        installDirectory(pkg.server),
        "node_modules",
        pkg.manifest.name,
        pkg.manifest.main
      );
      const result = spawnSync(
        process.execPath,
        [
          "--require",
          resolve(root, "tests/fixtures/offline-process.cjs"),
          "--require",
          resolve(root, "tests/fixtures/package-isolation.cjs"),
          entry,
        ],
        {
          cwd: scratch,
          env: environment,
          input: "",
          encoding: "utf8",
          timeout: 5000,
        }
      );
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(key);
      expect(result.stderr).not.toContain("fixture-token");
    });
  }
}

const invalidSettings: Array<[string, string, string | undefined]> = [
  ["jev", "AI_GATEWAY_API_KEY", "  "],
  ["jev", "JEV_TIMEOUT_MS", "private-timeout"],
  ["jev", "LOG_LEVEL", "private-level"],
  ["canvas", "CANVAS_API_TOKEN", "  "],
  ["canvas", "CANVAS_TOOL_CATEGORIES", "private-category"],
  ["clickup", "CLICKUP_API_TOKEN", "  "],
  ["flight", "DUFFEL_ENVIRONMENT", "private-environment"],
  ["flight", "LOG_LEVEL", "private-log-level"],
  ["elasticsearch", "ELASTICSEARCH_MAX_RETRIES", "private-retry"],
  ["elasticsearch", "ELASTICSEARCH_REQUEST_TIMEOUT", "0"],
];
for (const [server, key, value] of invalidSettings.filter(([server]) =>
  packages.some((pkg) => pkg.server === server)
)) {
  it(`${server} rejects invalid ${key} before starting MCP`, () => {
    const pkg = packages.find((item) => item.server === server)!;
    const entry = resolve(
      installDirectory(pkg.server),
      "node_modules",
      pkg.manifest.name,
      pkg.manifest.main
    );
    const result = spawnSync(
      process.execPath,
      [
        "--require",
        resolve(root, "tests/fixtures/offline-process.cjs"),
        "--require",
        resolve(root, "tests/fixtures/package-isolation.cjs"),
        entry,
      ],
      {
        cwd: scratch,
        env: {
          ...env,
          [key]: value,
          PACKAGE_FIXTURE_ROOT: installDirectory(pkg.server),
        },
        input: "",
        encoding: "utf8",
        timeout: 5000,
      }
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(key);
    expect(result.stderr).not.toContain("private-");
  });
}

it.runIf(packages.some((pkg) => pkg.server === "canvas"))(
  "packaged Canvas restricts both discovery and dispatch to selected categories",
  async () => {
    const pkg = packages.find((item) => item.server === "canvas")!;
    const entry = resolve(
      installDirectory(pkg.server),
      "node_modules",
      pkg.manifest.name,
      pkg.manifest.main
    );
    const stderr = createWriteStream(
      resolve(scratch, "canvas-categories.stderr")
    );
    await once(stderr, "open");
    const transport = new VerifiedStdioTransport({
      command: process.execPath,
      args: [
        "--require",
        resolve(root, "tests/fixtures/offline-process.cjs"),
        "--require",
        resolve(root, "tests/fixtures/package-isolation.cjs"),
        resolve(root, "tests/fixtures/start-package.cjs"),
        scratch,
        entry,
      ],
      env: {
        ...env,
        CANVAS_TOOL_CATEGORIES: "courses,pages",
        PACKAGE_FIXTURE_ROOT: installDirectory(pkg.server),
      },
      stderr,
    });
    const client = new Client(
      { name: "canvas-category-fixture", version: "1.0.0" },
      { capabilities: {} }
    );
    const errors: Error[] = [];
    client.onerror = (error) => errors.push(error);
    try {
      await client.connect(transport);
      const listed = await client.listTools();
      expect(listed.tools).toHaveLength(31);
      expect(listed.tools.map((tool) => tool.name)).toContain("list_courses");
      expect(listed.tools.map((tool) => tool.name)).toContain(
        "get_course_page"
      );
      expect(listed.tools.map((tool) => tool.name)).not.toContain("get_user");
      for (const [name, args, code] of [
        ["get_user", { user_id: "1" }, "invalid_input"],
        ["list_courses", {}, "internal_error"],
      ] as const) {
        const result = CallToolResultSchema.parse(
          await client.callTool({ name, arguments: args })
        );
        expect(result.isError).toBe(true);
        const content = result.content[0];
        if (content.type !== "text") throw new Error("Expected text");
        expect(JSON.parse(content.text)).toMatchObject({
          success: false,
          error: { code },
        });
        expect(content.text).not.toContain("Network access blocked");
      }
      expect(errors).toEqual([]);
    } finally {
      await client.close();
      await transport.close();
      await new Promise<void>((resolve) => stderr.end(resolve));
    }
    transport.assertProtocolAndExit();
  },
  15000
);
