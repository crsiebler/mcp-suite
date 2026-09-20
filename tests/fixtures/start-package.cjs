const { pathToFileURL } = require("node:url");
process.chdir(process.argv[2]);
import(pathToFileURL(process.argv[3]).href).catch(() => {
  console.error("Packaged entry failed to start");
  process.exitCode = 1;
});
