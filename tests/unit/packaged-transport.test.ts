import { expect, it } from "vitest";
import { VerifiedStdioTransport } from "../fixtures/packaged-transport.ts";

it.each([false, true])(
  "waits for process exit and detects trailing stdout (noise=%s)",
  async (noise) => {
    const frame =
      JSON.stringify({ jsonrpc: "2.0", method: "fixture_ready" }) + "\n";
    const transport = new VerifiedStdioTransport({
      command: process.execPath,
      args: [
        "-e",
        `process.stdout.write(${JSON.stringify(frame + (noise ? "trailing diagnostic" : ""))});setInterval(()=>{},1000);`,
      ],
      env: {},
      stderr: "ignore",
    });
    const ready = new Promise<void>((resolve) => {
      transport.onmessage = () => resolve();
    });
    await transport.start();
    try {
      await ready;
    } finally {
      await transport.close();
    }
    if (noise) expect(() => transport.assertProtocolAndExit()).toThrow();
    else expect(() => transport.assertProtocolAndExit()).not.toThrow();
  },
  10000
);
