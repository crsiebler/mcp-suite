import { once } from "node:events";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { execFileSync, spawnSync } from "node:child_process";
import {
  createWriteStream,
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
  LOG_LEVEL: "debug",
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
  ELASTICSEARCH_MAX_RETRIES: "0",
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
  it(`${pkg.server} keeps debug diagnostics off packaged MCP traffic`, async () => {
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
    const logPath = resolve(scratch, `${pkg.server}.stderr`);
    const stderr = createWriteStream(logPath);
    await once(stderr, "open");
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
      if (pkg.server === "canvas") expect(result.tools).toHaveLength(185);
      if (pkg.server === "aijobsearch") {
        for (const name of ["extract_skills", "match_jobs"]) {
          for (const args of [
            {},
            { taxonomy: "fixture", context: "fixture", type: "text" },
          ]) {
            const response = CallToolResultSchema.parse(
              await client.callTool({ name, arguments: args })
            );
            expect(response.isError).toBe(true);
            const content = response.content[0];
            if (content.type !== "text")
              throw new Error("Expected text result");
            expect(JSON.parse(content.text)).toMatchObject({
              success: false,
              error: {
                code: "context" in args ? "internal_error" : "invalid_input",
              },
            });
            expect(content.text).not.toContain("Network access blocked");
            expect(content.text).not.toContain("fixture-token");
          }
        }
      }
      if (pkg.server === "postgresql") {
        expect(result.tools.map((tool) => tool.name).sort()).toEqual([
          "check_dangerous_operations_allowed",
          "execute_query",
        ]);
        const policy = CallToolResultSchema.parse(
          await client.callTool({
            name: "check_dangerous_operations_allowed",
            arguments: {},
          })
        );
        const policyText = policy.content[0];
        if (policyText.type !== "text") throw new Error("Expected text result");
        expect(JSON.parse(policyText.text)).toMatchObject({ allowed: false });
        for (const args of [{}, { query: "SELECT 1" }]) {
          const failure = CallToolResultSchema.parse(
            await client.callTool({ name: "execute_query", arguments: args })
          );
          expect(failure.isError).toBe(true);
          const text = failure.content[0];
          if (text.type !== "text") throw new Error("Expected text result");
          expect(text.text).not.toContain("Network access blocked");
          expect(text.text).not.toContain("postgresql://");
        }
      }
      if (pkg.server === "flight") {
        const names = result.tools.map((tool) => tool.name);
        expect(names).not.toContain("duffel_cancel_order");
        for (const name of [
          "duffel_quote_order_cancellation",
          "duffel_confirm_order_cancellation",
        ]) {
          expect(names).toContain(name);
          const tool = result.tools.find((tool) => tool.name === name)!;
          expect(tool.annotations).toMatchObject({
            readOnlyHint: false,
            idempotentHint: false,
          });
          for (const args of [
            {},
            { order_id: "ord_fixture", cancellation_id: "ore_fixture" },
          ]) {
            const response = CallToolResultSchema.parse(
              await client.callTool({ name, arguments: args })
            );
            expect(response.isError).toBe(true);
            const content = response.content[0];
            if (content.type !== "text")
              throw new Error("Expected text result");
            const body = JSON.parse(content.text);
            expect(body.success).toBe(false);
            expect(body.error.code).toBe(
              "order_id" in args ? "internal_error" : "invalid_input"
            );
            expect(content.text).not.toContain("Network access blocked");
            expect(content.text).not.toContain("synthetic-test-key");
          }
        }
        await expect(
          client.callTool({
            name: "duffel_cancel_order",
            arguments: { order_id: "ord_fixture" },
          })
        ).rejects.toMatchObject({ code: -32601 });
      }
      if (pkg.server === "salesforce") {
        const result = CallToolResultSchema.parse(
          await client.callTool({
            name: "salesforce_bulk_delete",
            arguments: { sobject_type: "Account", ids: [] },
          })
        );
        expect(result.isError).toBe(true);
        const content = result.content[0];
        if (content.type !== "text") throw new Error("Expected text result");
        expect(JSON.parse(content.text)).toMatchObject({ success: false });
      }
      if (pkg.server === "elasticsearch") {
        expect(result.tools).toHaveLength(18);
        for (const tool of result.tools) {
          expect(tool.annotations).toMatchObject({
            readOnlyHint: expect.any(Boolean),
          });
          const response = CallToolResultSchema.parse(
            await client.callTool({ name: tool.name, arguments: {} })
          );
          expect(response.isError).toBe(true);
          const content = response.content[0];
          if (content.type !== "text") throw new Error("Expected text result");
          const data = JSON.parse(content.text);
          expect(data).toMatchObject({ success: false });
          if (
            Array.isArray(tool.inputSchema.required) &&
            tool.inputSchema.required.length > 0
          )
            expect(data.error.code).toBe("invalid_input");
          expect(content.text).not.toContain("Network access blocked");
          expect(content.text).not.toContain("fixture-token");
        }
        const search = CallToolResultSchema.parse(
          await client.callTool({
            name: "elasticsearch_search",
            arguments: { index: "fixture", size: 0 },
          })
        );
        expect(search.isError).toBe(true);
      }
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
          // Salesforce retains its existing envelope; ASU is the first migrated caller.
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
    expect(protocolErrors).toEqual([]);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics).not.toContain("fixture-token");
    expect(diagnostics).not.toContain("postgresql://");
  }, 15000);
}

const invalidSettings = [
  ["canvas", "CANVAS_API_TOKEN", "  "],
  ["canvas", "CANVAS_TOOL_CATEGORIES", "private-category"],
  ["clickup", "CLICKUP_API_TOKEN", "  "],
  ["aijobsearch", "AIJOBSEARCH_API_TOKEN", ""],
  ["aijobsearch", "AIJOBSEARCH_API_URL", "file:///private-endpoint"],
  ["flight", "DUFFEL_ENVIRONMENT", "private-environment"],
  ["flight", "LOG_LEVEL", "private-log-level"],
  ["elasticsearch", "ELASTICSEARCH_MAX_RETRIES", "private-retry"],
  ["elasticsearch", "ELASTICSEARCH_REQUEST_TIMEOUT", "0"],
];
for (const [server, key, value] of invalidSettings) {
  it(`${server} rejects invalid ${key} before starting MCP`, () => {
    const pkg = packages.find((item) => item.server === server)!;
    const entry = resolve(
      scratch,
      "node_modules",
      pkg.manifest.name,
      pkg.manifest.main
    );
    const result = spawnSync(
      process.execPath,
      ["--require", resolve(root, "tests/fixtures/offline-process.cjs"), entry],
      {
        cwd: scratch,
        env: { ...env, [key]: value },
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

it("packaged Canvas restricts both discovery and dispatch to selected categories", async () => {
  const pkg = packages.find((item) => item.server === "canvas")!;
  const entry = resolve(
    scratch,
    "node_modules",
    pkg.manifest.name,
    pkg.manifest.main
  );
  const stderr = createWriteStream(
    resolve(scratch, "canvas-categories.stderr")
  );
  await once(stderr, "open");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      "--require",
      resolve(root, "tests/fixtures/offline-process.cjs"),
      resolve(root, "tests/fixtures/start-package.cjs"),
      scratch,
      entry,
    ],
    env: { ...env, CANVAS_TOOL_CATEGORIES: "courses,pages" },
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
    expect(listed.tools.map((tool) => tool.name)).toContain("get_course_page");
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
}, 15000);
