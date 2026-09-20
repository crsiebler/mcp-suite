// Test-owned child process guard: server startup/tool discovery must not contact
// a provider. Fail immediately rather than relying on fake endpoint timeouts.
const { syncBuiltinESMExports } = require("node:module");
function blocked() {
  throw new Error("Network access blocked by offline test");
}
// Socket connection failures are asynchronous in Node. Preserve that contract
// so pg can remove failed clients from its pool and complete pool.end().
require("node:net").Socket.prototype.connect = function () {
  queueMicrotask(() =>
    this.destroy(new Error("Network access blocked by offline test"))
  );
  return this;
};
require("node:tls").connect = blocked;
require("node:http").request = blocked;
require("node:https").request = blocked;
globalThis.fetch = blocked;
syncBuiltinESMExports();
