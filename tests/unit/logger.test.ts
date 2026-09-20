import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../../shared/utils/logger.ts";

const output = () =>
  [console.debug, console.info, console.warn, console.error]
    .flatMap((method) => vi.mocked(method).mock.calls.flat())
    .join("\n");

beforeEach(() => {
  for (const method of ["debug", "info", "warn", "error"] as const) {
    vi.spyOn(console, method).mockImplementation(() => undefined);
  }
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("protocol-safe diagnostics", () => {
  it("sends every enabled level to stderr and keeps contextual fields", () => {
    const logger = new Logger("debug", { server: "fixture" }).withContext({
      action: "list_tools",
    });
    for (const level of ["debug", "info", "warn", "error"] as const) {
      logger[level]("Operation completed", { count: 2 });
    }
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(4);
    expect(output()).toContain("fixture");
    expect(output()).toContain("list_tools");
    expect(output()).toContain("count");
  });

  it("preserves level filtering", () => {
    const logger = new Logger("warn");
    logger.debug("hidden debug");
    logger.info("hidden info");
    logger.warn("visible warning");
    logger.error("visible error");
    expect(output()).not.toContain("hidden");
    expect(output()).toContain("visible warning");
    expect(output()).toContain("visible error");
  });

  it("redacts credential and payload fields recursively", () => {
    new Logger("debug").debug("Provider request", {
      nested: {
        apiKey: "secret-api",
        access_token: "secret-token",
        Authorization: "Bearer secret-header",
        password: "secret-password",
        connectionString: "postgresql://user:secret-db@localhost/database",
        clientSecret: "secret-client",
        cookie: "secret-cookie",
        query: "select 'secret-sql'",
        body: { private: "secret-body" },
        response: { data: "secret-response" },
      },
      status: 422,
    });
    expect(output()).not.toContain("secret-");
    expect(output()).toContain("REDACTED");
    expect(output()).toContain("422");
  });

  it("scrubs credentials in text and keeps one bounded log line", () => {
    new Logger().info(
      "Failed https://user:secret-url@host.invalid/path?token=secret-query " +
        "Bearer secret-bearer password=secret-assignment\nforged log " +
        "x".repeat(20000)
    );
    expect(output()).not.toContain("secret-");
    expect(output()).not.toContain("\n");
    expect(Buffer.byteLength(output())).toBeLessThanOrEqual(8192);
  });

  it("handles cycles and BigInt without executing getters or toJSON", () => {
    const getter = vi.fn(() => {
      throw new Error("secret-getter");
    });
    const toJSON = vi.fn(() => {
      throw new Error("secret-serializer");
    });
    const data: Record<string, unknown> = { count: 2n, toJSON };
    data.self = data;
    Object.defineProperty(data, "danger", { enumerable: true, get: getter });
    expect(() => new Logger().info("Safe metadata", data)).not.toThrow();
    expect(getter).not.toHaveBeenCalled();
    expect(toJSON).not.toHaveBeenCalled();
    expect(output()).toContain("Safe metadata");
    expect(output()).toContain("Circular");
  });

  it("records safe error metadata without error bodies, stacks or messages", () => {
    const error = Object.assign(new Error("secret-message"), {
      code: "ETIMEDOUT",
      config: { headers: { Authorization: "secret-auth" } },
      response: { data: "secret-provider" },
    });
    new Logger().error("Provider failed", error);
    expect(output()).toContain("ETIMEDOUT");
    expect(output()).not.toContain("secret-");
    expect(output()).not.toContain("logger.test.ts");
  });

  it("survives hostile metadata and synchronous diagnostic sink failures", () => {
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("secret-proxy");
        },
      }
    );
    expect(() => new Logger().error("Operation failed", hostile)).not.toThrow();
    expect(output()).not.toContain("secret-proxy");
    vi.mocked(console.error).mockImplementation(() => {
      throw new Error("sink unavailable");
    });
    expect(() => new Logger().error("Original failure")).not.toThrow();
  });
});

it("does not serialize arbitrary rejection strings or non-Error provider objects", () => {
  new Logger().error("Rejected operation", "private-rejection");
  new Logger().error("Provider rejected operation", {
    detail: "private-detail",
    status: 503,
  });
  expect(output()).not.toContain("private-");
  expect(output()).toContain("503");
});
