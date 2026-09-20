// Test-only guard: a missing dependency must not resolve from the parent repo.
// This is a fixture check, not a sandbox for untrusted code.
if (require("node:worker_threads").isMainThread) {
  const Module = require("node:module");
  const { realpathSync } = require("node:fs");
  const { isAbsolute, resolve, sep } = require("node:path");
  const { pathToFileURL } = require("node:url");
  const root = realpathSync(process.env.PACKAGE_FIXTURE_ROOT);
  const bootstrap = realpathSync(process.argv[1]);
  const original = Module._resolveFilename;
  Module._resolveFilename = function (...args) {
    const result = original.apply(this, args);
    if (isAbsolute(result)) {
      const actual = realpathSync(result);
      if (actual !== bootstrap && !actual.startsWith(root + sep))
        throw new Error("Dependency escaped isolated package installation");
    }
    return result;
  };
  Module.register(pathToFileURL(resolve(__dirname, "package-isolation.mjs")), {
    parentURL: pathToFileURL(__filename),
    data: { root, bootstrap },
  });
}
