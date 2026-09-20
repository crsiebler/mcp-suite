import type { ChildProcess } from "node:child_process";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { expect } from "vitest";

// SDK0.5 close() initiates termination but does not await the child close event.
// Observe its pinned transport implementation in this test adapter only.
export class VerifiedStdioTransport extends StdioClientTransport {
  private exitEvent?: Promise<void>;
  private exited = false;
  private stdout: Buffer[] = [];

  override async start() {
    await super.start();
    const child = (this as unknown as { _process: ChildProcess })._process;
    if (!child?.stdout) throw new Error("SDK child observation unavailable");
    child.stdout.on("data", (chunk: Buffer) =>
      this.stdout.push(Buffer.from(chunk))
    );
    this.exitEvent = new Promise<void>((resolve) => {
      child.once("close", () => {
        this.exited = true;
        resolve();
      });
    });
  }

  override async close() {
    await super.close();
    if (!this.exitEvent) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.exitEvent,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Packaged process did not close")),
            5000
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  assertProtocolAndExit(forbidden?: RegExp) {
    expect(this.exited).toBe(true);
    const stdout = Buffer.concat(this.stdout).toString("utf8");
    if (forbidden) expect(stdout).not.toMatch(forbidden);
    expect(stdout.length).toBeGreaterThan(0);
    expect(stdout.endsWith("\n")).toBe(true);
    for (const line of stdout.split("\n").filter(Boolean))
      expect(JSON.parse(line)).toMatchObject({ jsonrpc: "2.0" });
  }
}
