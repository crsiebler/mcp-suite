import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const cli = resolve(root, "node_modules/@changesets/cli/bin.js");
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const write = (path: string, data: unknown) =>
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
function command(cwd: string, executable: string, args: string[]) {
  return execFileSync(executable, args, {
    cwd,
    encoding: "utf8",
    timeout: 20000,
    env: {
      ...process.env,
      PATH: `${resolve(root, "node_modules/.bin")}:${process.env.PATH}`,
      CI: "true",
      npm_config_offline: "true",
      npm_config_ignore_scripts: "true",
    },
  });
}
function fixture(run: (cwd: string) => void, dependent = false) {
  mkdirSync(resolve(root, "dist/test-artifacts"), { recursive: true });
  const cwd = mkdtempSync(resolve(root, "dist/test-artifacts/changesets-"));
  try {
    mkdirSync(resolve(cwd, ".changeset"));
    write(
      resolve(cwd, ".changeset/config.json"),
      read(resolve(root, ".changeset/config.json"))
    );
    write(resolve(cwd, "package.json"), {
      name: "fixture-root",
      private: true,
      version: "1.0.0",
      workspaces: ["servers/*"],
      scripts: {
        "release:version": read(resolve(root, "package.json")).scripts[
          "release:version"
        ],
        "catalog:generate": "node verify-catalog-boundary.cjs",
      },
    });
    mkdirSync(resolve(cwd, "outside"));
    write(resolve(cwd, "outside/package.json"), {
      name: "@fixture/excluded",
      version: "1.0.0",
    });
    writeFileSync(
      resolve(cwd, "verify-catalog-boundary.cjs"),
      `const fs=require("node:fs");const lock=JSON.parse(fs.readFileSync("package-lock.json"));for(const name of ["alpha","beta"]){const p=JSON.parse(fs.readFileSync("servers/"+name+"/package.json"));if(lock.packages["servers/"+name].version!==p.version)throw Error("Catalog ran before lock synchronization");}fs.writeFileSync("catalog-invoked","yes");`
    );
    for (const name of ["alpha", "beta"]) {
      mkdirSync(resolve(cwd, "servers", name), { recursive: true });
      write(resolve(cwd, "servers", name, "package.json"), {
        name: `@fixture/${name}`,
        version: "1.0.0",
        ...(name === "beta" && dependent
          ? { dependencies: { "@fixture/alpha": "^1.0.0" } }
          : {}),
      });
    }
    command(cwd, "git", [
      "init",
      "--quiet",
      "-b",
      read(resolve(cwd, ".changeset/config.json")).baseBranch,
    ]);
    command(cwd, "npm", [
      "install",
      "--package-lock-only",
      "--ignore-scripts",
      "--offline",
      "--no-audit",
      "--no-fund",
    ]);
    command(cwd, "git", ["add", "."]);
    command(cwd, "git", [
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "chore(fixture): baseline",
    ]);
    run(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
function changeset(
  cwd: string,
  id: string,
  bumps: Record<string, string>,
  summary: string
) {
  writeFileSync(
    resolve(cwd, ".changeset", `${id}.md`),
    `---\n${Object.entries(bumps)
      .map(([name, bump]) => `"@fixture/${name}": ${bump}`)
      .join("\n")}\n---\n\n${summary}\n`
  );
}
function prepare(cwd: string) {
  const beforeHead = command(cwd, "git", ["rev-parse", "HEAD"]);
  const beforeTags = command(cwd, "git", ["tag", "--list"]);
  writeFileSync(resolve(cwd, "unrelated.txt"), "preserve me");
  const output = command(cwd, process.execPath, [
    cli,
    "status",
    "--output",
    resolve(cwd, "plan.json"),
  ]);
  const plan = read(resolve(cwd, "plan.json"));
  expect(
    plan.releases.some((r: { name: string }) => r.name === "@fixture/excluded")
  ).toBe(false);
  command(cwd, "npm", ["run", "release:version"]);
  expect(readFileSync(resolve(cwd, "catalog-invoked"), "utf8")).toBe("yes");
  expect(command(cwd, "git", ["rev-parse", "HEAD"])).toBe(beforeHead);
  expect(command(cwd, "git", ["tag", "--list"])).toBe(beforeTags);
  expect(command(cwd, "git", ["diff", "--cached", "--name-only"])).toBe("");
  expect(readFileSync(resolve(cwd, "unrelated.txt"), "utf8")).toBe(
    "preserve me"
  );
  expect(read(resolve(cwd, "package.json")).version).toBe("1.0.0");
  expect(existsSync(resolve(cwd, "CHANGELOG.md"))).toBe(false);
  const lock = read(resolve(cwd, "package-lock.json"));
  for (const name of ["alpha", "beta"]) {
    const pkg = read(resolve(cwd, "servers", name, "package.json"));
    expect(lock.packages[`servers/${name}`].version).toBe(pkg.version);
    expect(lock.packages[`servers/${name}`].dependencies).toEqual(
      pkg.dependencies
    );
  }
  return { plan, output };
}
it.each([
  {
    title: "one patch",
    changes: [{ alpha: "patch" }],
    versions: ["1.0.1", "1.0.0"],
  },
  {
    title: "several independent packages",
    changes: [{ alpha: "minor", beta: "patch" }],
    versions: ["1.1.0", "1.0.1"],
  },
  {
    title: "combined bump levels and breaking migration",
    changes: [{ alpha: "patch" }, { alpha: "major" }, { alpha: "minor" }],
    versions: ["2.0.0", "1.0.0"],
  },
])(
  "prepares $title without publishing or Git mutation",
  ({ changes, versions }) =>
    fixture((cwd) => {
      changes.forEach((bumps, index) =>
        changeset(
          cwd,
          `change-${index}`,
          bumps,
          `Change ${index}: migrate the caller to the new result contract.`
        )
      );
      const { plan } = prepare(cwd);
      expect(
        plan.releases.some((r: { name: string }) => r.name === "fixture-root")
      ).toBe(false);
      for (const [index, name] of ["alpha", "beta"].entries()) {
        expect(
          read(resolve(cwd, "servers", name, "package.json")).version
        ).toBe(versions[index]);
        const path = resolve(cwd, "servers", name, "CHANGELOG.md");
        if (versions[index] !== "1.0.0") {
          const text = readFileSync(path, "utf8");
          expect(text).toContain(`## ${versions[index]}`);
          expect(text).toContain(
            "migrate the caller to the new result contract"
          );
        } else expect(existsSync(path)).toBe(false);
      }
    })
);
it("bumps an internal dependent when its required range becomes incompatible", () =>
  fixture((cwd) => {
    changeset(
      cwd,
      "breaking",
      { alpha: "major" },
      "Replace the response contract; migrate consumers."
    );
    prepare(cwd);
    expect(read(resolve(cwd, "servers/alpha/package.json")).version).toBe(
      "2.0.0"
    );
    expect(read(resolve(cwd, "servers/beta/package.json"))).toMatchObject({
      version: "1.0.1",
      dependencies: { "@fixture/alpha": "^2.0.0" },
    });
    expect(
      readFileSync(resolve(cwd, "servers/beta/CHANGELOG.md"), "utf8")
    ).toContain("@fixture/alpha@2.0.0");
  }, true));
it("an empty no-release changeset changes no versions or changelogs", () =>
  fixture((cwd) => {
    changeset(
      cwd,
      "docs-only",
      {},
      "Documentation correction; no shipped behavior changes."
    );
    const { plan } = prepare(cwd);
    expect(plan.releases).toEqual([]);
    for (const name of ["alpha", "beta"]) {
      expect(read(resolve(cwd, "servers", name, "package.json")).version).toBe(
        "1.0.0"
      );
      expect(existsSync(resolve(cwd, "servers", name, "CHANGELOG.md"))).toBe(
        false
      );
    }
  }));
it("requires explicit changesets for copied shared-code consumers", () =>
  fixture((cwd) => {
    mkdirSync(resolve(cwd, "shared"));
    writeFileSync(
      resolve(cwd, "shared/helper.ts"),
      "export const changed = true;\n"
    );
    changeset(cwd, "shared", { alpha: "patch" }, "A copied helper changed.");
    command(cwd, process.execPath, [
      cli,
      "status",
      "--output",
      resolve(cwd, "partial-plan.json"),
    ]);
    expect(
      read(resolve(cwd, "partial-plan.json")).releases.map(
        (r: { name: string }) => r.name
      )
    ).toEqual(["@fixture/alpha"]);
    changeset(
      cwd,
      "shared",
      { alpha: "patch", beta: "patch" },
      "Correct shared error serialization in both bundled consumers."
    );
    const { plan } = prepare(cwd);
    expect(plan.releases.map((r: { name: string }) => r.name).sort()).toEqual([
      "@fixture/alpha",
      "@fixture/beta",
    ]);
  }));
