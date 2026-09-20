import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Reuse pinned dependency versions/integrities, but give npm exactly one root
// dependency. npm owns graph resolution/reification; this does not invent a
// separate dependency traversal algorithm.
export function installPackage(
  root: string,
  directory: string,
  server: string,
  tarball: { name: string; path: string; integrity: string }
) {
  mkdirSync(directory, { recursive: true });
  copyFileSync(
    resolve(root, "tests/fixtures/package-provider-responses.mjs"),
    resolve(directory, "provider-responses.mjs")
  );
  const lock = JSON.parse(
    readFileSync(resolve(root, "package-lock.json"), "utf8")
  );
  const original = structuredClone(lock.packages);
  for (const [path, value] of Object.entries(original)) {
    if (path.startsWith("servers/") || (value as { link?: boolean }).link)
      delete lock.packages[path];
  }
  const workspace = `servers/${server}`;
  const installed = `node_modules/${tarball.name}`;
  const dependencies = { [tarball.name]: `file:${tarball.path}` };
  lock.packages[installed] = {
    ...original[workspace],
    resolved: dependencies[tarball.name],
    integrity: tarball.integrity,
  };
  delete lock.packages[installed].devDependencies;
  for (const [path, value] of Object.entries(original)) {
    if (path.startsWith(`${workspace}/node_modules/`))
      lock.packages[installed + path.slice(workspace.length)] = value;
  }
  lock.name = "isolated-package-fixture";
  lock.version = "1.0.0";
  lock.packages[""] = { name: lock.name, version: lock.version, dependencies };
  writeFileSync(
    resolve(directory, "package.json"),
    JSON.stringify({ ...lock.packages[""], private: true })
  );
  writeFileSync(resolve(directory, "package-lock.json"), JSON.stringify(lock));
  execFileSync(
    "npm",
    [
      "ci",
      "--omit=dev",
      "--offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ],
    {
      cwd: directory,
      timeout: 60000,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  // Check the installed graph, not merely the transformed fixture lock.
  execFileSync("npm", ["ls", "--omit=dev", "--all", "--json"], {
    cwd: directory,
    timeout: 10000,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
