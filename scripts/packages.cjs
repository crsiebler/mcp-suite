const { readFileSync, readdirSync, realpathSync } = require("node:fs");
const { resolve, relative, sep, basename } = require("node:path");

// npm's workspace metadata is the package inventory. Only repository-owned
// server directories are supported; no shell or second list of server names.
function readPackages(root) {
  const manifest = JSON.parse(
    readFileSync(resolve(root, "package.json"), "utf8")
  );
  if (!Array.isArray(manifest.workspaces))
    throw new Error("Missing npm workspaces");
  const paths = manifest.workspaces.flatMap((entry) => {
    if (
      typeof entry !== "string" ||
      !/^servers\/(?:[a-z0-9-]+|\*)$/.test(entry)
    ) {
      throw new Error("Unsupported server workspace path");
    }
    return entry.endsWith("/*")
      ? readdirSync(resolve(root, "servers"), { withFileTypes: true })
          .filter((item) => item.isDirectory() || item.isSymbolicLink())
          .map((item) => `servers/${item.name}`)
      : [entry];
  });
  const names = new Set();
  return [...new Set(paths)].sort().map((directory) => {
    const path = resolve(root, directory);
    if (
      realpathSync(path) !== path ||
      relative(root, path).startsWith(`..${sep}`)
    ) {
      throw new Error("Workspace must be a local directory, not a symlink");
    }
    const pkg = JSON.parse(readFileSync(resolve(path, "package.json"), "utf8"));
    if (typeof pkg.name !== "string" || names.has(pkg.name)) {
      throw new Error("Missing or duplicate workspace package name");
    }
    names.add(pkg.name);
    return { directory, path, server: basename(path), manifest: pkg };
  });
}
module.exports = { readPackages };
