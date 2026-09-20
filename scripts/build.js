#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { mkdirSync, rmSync, writeFileSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");
const { readPackages } = require("./packages.cjs");

const defaultRoot = resolve(__dirname, "..");

function compile(root, project, output, run) {
  const compiler = resolve(root, "node_modules/typescript/bin/tsc");
  if (!existsSync(compiler))
    throw new Error("TypeScript is missing; run npm ci first");
  rmSync(output, { recursive: true, force: true });
  const result = run(process.execPath, [compiler, "--project", project], {
    cwd: root,
    encoding: "utf8",
    // Compiler diagnostics contain source locations, not environment dumps.
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) {
    throw new Error(`TypeScript failed for ${project}`);
  }
}

function main(
  args = process.argv.slice(2),
  { root = defaultRoot, run = spawnSync } = {}
) {
  const packages = readPackages(root);
  if (args.length === 1 && args[0] === "--list") {
    console.log(JSON.stringify(packages.map((pkg) => pkg.server)));
    return;
  }
  if (
    args.length > 1 ||
    (args.length && !/^--server=[a-z0-9-]+$/.test(args[0]))
  ) {
    throw new Error(
      "Usage: npm run build -- [--server=<name>|--server=all|--list]"
    );
  }
  const target = args.length ? args[0].slice("--server=".length) : "all";
  const selected =
    target === "all"
      ? packages
      : packages.filter((pkg) => pkg.server === target);
  if (!selected.length) throw new Error(`Unknown server: ${target}`);

  console.error("Building shared modules");
  const sharedOutput = resolve(root, "dist/shared");
  compile(root, resolve(root, "shared/tsconfig.json"), sharedOutput, run);
  mkdirSync(sharedOutput, { recursive: true });
  writeFileSync(resolve(sharedOutput, "package.json"), '{"type":"module"}\n');
  for (const pkg of selected) {
    console.error(`Building ${pkg.manifest.name}`);
    // Each standalone package compiles its own copy of shared sources, so no
    // runtime imports escape its tarball. The shared pass validates them first.
    compile(
      root,
      resolve(pkg.path, "tsconfig.json"),
      resolve(pkg.path, "dist"),
      run
    );
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { main };
