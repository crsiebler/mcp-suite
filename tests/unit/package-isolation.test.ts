import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const root = resolve(__dirname, "../..");
it.each([
  ["cjs", 'require("typescript");'],
  ["mjs", 'import "axios";'],
])(
  "rejects %s dependencies resolved from the ancestor checkout",
  (extension, source) => {
    mkdirSync(resolve(root, "dist/test-artifacts"), { recursive: true });
    const fixture = mkdtempSync(resolve(root, "dist/test-artifacts/isolated-"));
    try {
      const entry = resolve(fixture, `entry.${extension}`);
      writeFileSync(entry, source);
      const run = (guard: boolean) =>
        spawnSync(
          process.execPath,
          [
            ...(guard
              ? [
                  "--require",
                  resolve(root, "tests/fixtures/package-isolation.cjs"),
                ]
              : []),
            entry,
          ],
          {
            cwd: fixture,
            env: { PACKAGE_FIXTURE_ROOT: fixture },
            encoding: "utf8",
            timeout: 10000,
          }
        );
      expect(run(false).status).toBe(0);
      const blocked = run(true);
      expect(blocked.status).not.toBe(0);
      expect(blocked.stderr).toContain(
        "Dependency escaped isolated package installation"
      );
      writeFileSync(resolve(fixture, "local.cjs"), "module.exports = 1;");
      writeFileSync(
        entry,
        extension === "cjs"
          ? 'require("node:fs"); require("./local.cjs");'
          : 'import "node:fs"; import "./local.cjs";'
      );
      expect(run(true).status).toBe(0);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }
);
