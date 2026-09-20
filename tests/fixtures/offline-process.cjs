// Test-owned child process guard: server startup/tool discovery must not contact
// a provider. Fail immediately rather than relying on fake endpoint timeouts.
const { syncBuiltinESMExports } = require("node:module");
function blocked() {
  throw new Error("Network access blocked by offline test");
}
require("node:net").Socket.prototype.connect = blocked;
require("node:tls").connect = blocked;
require("node:http").request = blocked;
require("node:https").request = blocked;
globalThis.fetch = blocked;
syncBuiltinESMExports();
