import { pathToFileURL } from "node:url";
import { once } from "node:events";
import { createWriteStream, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { expect } from "vitest";
import { VerifiedStdioTransport } from "./packaged-transport.ts";

const scenarios: Record<
  string,
  { name: string; arguments: Record<string, unknown>; expected: object }
> = {
  canvas: {
    name: "list_courses",
    arguments: {},
    expected: [{ id: 42, name: "fixture-success" }],
  },
  clickup: {
    name: "get_teams",
    arguments: {},
    expected: { teams: [{ id: "42", name: "fixture-success" }] },
  },
  flight: {
    name: "duffel_get_airlines",
    arguments: { limit: 1 },
    expected: [{ id: "arl_fixture", name: "fixture-success" }],
  },
  elasticsearch: {
    name: "elasticsearch_search",
    arguments: { index: "fixture", query: { match_all: {} } },
    expected: {
      hits: {
        total: { value: 1, relation: "eq" },
        hits: [{ _id: "42", _source: { name: "fixture-success" } }],
      },
      timed_out: false,
    },
  },
  postgresql: {
    name: "execute_query",
    arguments: { query: "SELECT 'fixture-success' AS name" },
    expected: {
      rows: [{ name: "fixture-success" }],
      returnedRowCount: 1,
      truncated: false,
    },
  },
  salesforce: {
    name: "salesforce_query",
    arguments: { soql: "SELECT Id, Name FROM Account LIMIT 1" },
    expected: {
      success: true,
      data: {
        records: [{ Id: "001000000000001AAA", Name: "fixture-success" }],
        done: true,
        totalSize: 1,
      },
    },
  },
};

export async function checkSuccessContract(
  root: string,
  cwd: string,
  installation: string,
  server: string,
  entry: string,
  environment: Record<string, string>
) {
  const scenario = scenarios[server];
  if (!scenario) throw new Error("Missing package success scenario");
  const log = resolve(cwd, `${server}-success.stderr`);
  const stderr = createWriteStream(log);
  await once(stderr, "open");
  const client = new Client(
    { name: "success-fixture", version: "1.0.0" },
    { capabilities: {} }
  );
  const transport = new VerifiedStdioTransport({
    command: process.execPath,
    args: [
      "--require",
      resolve(root, "tests/fixtures/offline-process.cjs"),
      "--require",
      resolve(root, "tests/fixtures/package-isolation.cjs"),
      "--import",
      pathToFileURL(resolve(installation, "provider-responses.mjs")).href,
      resolve(root, "tests/fixtures/start-package.cjs"),
      cwd,
      entry,
    ],
    env: {
      ...environment,
      PACKAGE_FIXTURE_ROOT: installation,
      PACKAGE_FIXTURE_SERVER: server,
    },
    stderr,
  });
  const errors: Error[] = [];
  client.onerror = (error) => errors.push(error);
  try {
    await client.connect(transport);
    expect((await client.listTools()).tools.map((tool) => tool.name)).toContain(
      scenario.name
    );
    const result = CallToolResultSchema.parse(
      await client.callTool({
        name: scenario.name,
        arguments: scenario.arguments,
      })
    );
    expect(result.isError).not.toBe(true);
    const text = result.content[0];
    if (text.type !== "text") throw new Error("Expected text tool result");
    expect(JSON.parse(text.text)).toMatchObject(scenario.expected);
    expect(errors).toEqual([]);
  } finally {
    await client.close();
    await transport.close();
    await new Promise<void>((resolve) => stderr.end(resolve));
  }
  transport.assertProtocolAndExit();
  if (server === "postgresql")
    expect(
      JSON.parse(
        readFileSync(resolve(installation, "provider-cleanup.json"), "utf8")
      )
    ).toEqual({ released: true, committed: true });
  expect(readFileSync(log, "utf8")).not.toMatch(
    /fixture-token|postgresql:\/\//
  );
}
