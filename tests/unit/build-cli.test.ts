import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const script = resolve(root, "scripts/build.js");
mkdirSync(resolve(root, "dist/test-artifacts"), { recursive: true });
const scratch = mkdtempSync(resolve(root, "dist/test-artifacts/build-cli-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

it("rejects unknown servers before invoking a compiler from an unrelated cwd", () => {
  const result = spawnSync(process.execPath, [script, "--server=not-real"], {
    cwd: scratch,
    encoding: "utf8",
    timeout: 10000,
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Unknown server: not-real");
  expect(result.stdout).not.toContain("Building");
});

it("lists workspace packages without building from an unrelated cwd", () => {
  const result = execFileSync(process.execPath, [script, "--list"], {
    cwd: scratch,
    encoding: "utf8",
    timeout: 10000,
  });
  expect(JSON.parse(result)).toEqual([
    "canvas",
    "clickup",
    "elasticsearch",
    "flight",
    "postgresql",
    "salesforce",
  ]);
});

it("passes literal compiler arguments, builds shared first, and stops on failure", () => {
  const { main } = require("../../scripts/build.js");
  const { writeFileSync } = require("node:fs");
  const fixture = resolve(scratch, "fixture with spaces");
  for (const dir of ["servers/demo", "shared", "node_modules/typescript/bin"]) {
    mkdirSync(resolve(fixture, dir), { recursive: true });
  }
  writeFileSync(
    resolve(fixture, "package.json"),
    JSON.stringify({ workspaces: ["servers/*"] })
  );
  writeFileSync(
    resolve(fixture, "servers/demo/package.json"),
    JSON.stringify({ name: "@fixture/demo" })
  );
  writeFileSync(resolve(fixture, "node_modules/typescript/bin/tsc"), "");
  const calls: string[][] = [];
  const run = (_command: string, args: string[], options: { cwd: string }) => {
    calls.push(args);
    expect(options.cwd).toBe(fixture);
    return { status: 0 };
  };
  main(["--server=demo"], { root: fixture, run });
  expect(calls.map((args) => args.slice(1))).toEqual([
    ["--project", resolve(fixture, "shared/tsconfig.json")],
    ["--project", resolve(fixture, "servers/demo/tsconfig.json")],
  ]);
  let attempts = 0;
  expect(() =>
    main([], {
      root: fixture,
      run: () => {
        attempts++;
        return { status: 1 };
      },
    })
  ).toThrow("TypeScript failed");
  expect(attempts).toBe(1);
  expect(() => main(["--server=demo;echo"], { root: fixture, run })).toThrow(
    "Usage:"
  );
  expect(calls).toHaveLength(2);
});
