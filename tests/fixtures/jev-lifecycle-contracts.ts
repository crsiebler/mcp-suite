import { createRequire } from "node:module";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { createWriteStream, readFileSync, existsSync } from "node:fs";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, vi } from "vitest";
import { VerifiedStdioTransport } from "./packaged-transport.ts";

export async function checkJevLifecycle(
  root: string,
  cwd: string,
  installation: string,
  entry: string,
  environment: Record<string, string>,
  mode: string
) {
  const log = resolve(cwd, `jev-${mode}.stderr`);
  const stderr = createWriteStream(log);
  await once(stderr, "open");
  const eventFile = resolve(installation, `jev-${mode}.json`);
  // Use the isolated package's current client: root SDK 0.5 sends the obsolete
  // bare `cancelled` method rather than `notifications/cancelled`.
  const { Client } = await import(
    pathToFileURL(
      createRequire(entry).resolve("@modelcontextprotocol/sdk/client/index.js")
    ).href
  );
  const client = new Client(
    { name: "jev-lifecycle-fixture", version: "1" },
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
      PACKAGE_FIXTURE_SERVER: "jev",
      PACKAGE_FIXTURE_JEV_MODE: mode,
      JEV_TIMEOUT_MS: "120000",
    },
    stderr,
  });
  const errors: string[] = [];
  client.onerror = (error: Error) => errors.push(error.message);
  const call = {
    name: "jev_evaluate",
    arguments: {
      state: "fixture-state",
      questions: {
        ready: { type: "boolean", instructions: "fixture-instructions" },
      },
    },
  };
  try {
    await client.connect(transport);
    await client.listTools();
    if (["cancel", "eof", "sigterm"].includes(mode)) {
      const controller = new AbortController();
      const pending = client
        .callTool(call, CallToolResultSchema, { signal: controller.signal })
        .catch(() => undefined);
      await vi.waitFor(
        () =>
          expect(
            existsSync(eventFile) &&
              JSON.parse(readFileSync(eventFile, "utf8")).started
          ).toBe(true),
        { timeout: 2000, interval: 10 }
      );
      if (mode === "cancel") {
        controller.abort();
        await pending;
        await vi.waitFor(
          () =>
            expect(JSON.parse(readFileSync(eventFile, "utf8")).aborted).toBe(
              true
            ),
          { timeout: 1000, interval: 10 }
        );
        const next = await Promise.all([
          client.callTool(call),
          client.callTool(call),
        ]);
        for (const result of next) expect(result.isError).not.toBe(true);
      } else {
        const child = (transport as unknown as { _process: ChildProcess })
          ._process;
        // Observe natural completion before SDK close() could terminate the child.
        const exit = new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("Jev did not exit after shutdown")),
            3000
          );
          child.once("close", () => {
            clearTimeout(timer);
            resolve();
          });
        });
        if (mode === "eof") child.stdin!.end();
        else child.kill("SIGTERM");
        await exit;
        expect(child.exitCode).toBe(0);
        expect(JSON.parse(readFileSync(eventFile, "utf8")).aborted).toBe(true);
        await pending;
      }
    } else {
      const result = CallToolResultSchema.parse(await client.callTool(call));
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).toContain(
        mode === "warning"
          ? "PROVIDER_WARNING"
          : mode === "oversize"
            ? "RESPONSE_TOO_LARGE"
            : "UNAUTHORIZED"
      );
    }
  } finally {
    await client.close();
    await transport.close();
    await new Promise<void>((resolve) => stderr.end(resolve));
  }
  transport.assertProtocolAndExit(
    /fixture-state|fixture-instructions|private-provider|fixture-token/
  );
  expect(readFileSync(log, "utf8")).not.toMatch(
    /fixture-state|fixture-instructions|private-provider|fixture-token/
  );
  expect(errors.join(" ")).not.toMatch(/private-provider|fixture-token/);
}
