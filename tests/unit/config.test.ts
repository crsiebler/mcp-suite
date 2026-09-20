import { afterEach, describe, expect, it, vi } from "vitest";
import * as config from "../../shared/utils/config.ts";

afterEach(() => {
  vi.unstubAllEnvs();
});
function setEnv(name: string, value: string | undefined): void {
  vi.stubEnv(name, value ?? "");
  if (value === undefined) delete process.env[name];
}
const key = "MCP_TEST_SETTING";

describe("required environment settings", () => {
  it.each([undefined, "", "  "])(
    "rejects missing/blank %s without exposing values",
    (value) => {
      setEnv(key, value);
      expect(() => config.getEnvVar(key)).toThrow(key);
    }
  );
  it("preserves supplied credential bytes and uses defaults only when absent", () => {
    setEnv(key, "  synthetic-secret  ");
    expect(config.getEnvVar(key)).toBe("  synthetic-secret  ");
    setEnv(key, undefined);
    expect(config.getEnvVar(key, "fallback")).toBe("fallback");
    setEnv(key, "");
    expect(() => config.getEnvVar(key, "fallback")).toThrow(key);
  });
});

describe("typed environment settings", () => {
  it.each(["yes", "1", "false-extra", "", " true "])(
    "rejects malformed boolean %s",
    (value) => {
      setEnv(key, value);
      expect(() => config.getBooleanEnvVar(key, false)).toThrow(key);
    }
  );
  it("parses booleans exactly and has an explicit absent default", () => {
    setEnv(key, undefined);
    expect(config.getBooleanEnvVar(key, false)).toBe(false);
    setEnv(key, "true");
    expect(config.getBooleanEnvVar(key, false)).toBe(true);
    setEnv(key, "false");
    expect(config.getBooleanEnvVar(key, true)).toBe(false);
  });
  it.each(["3ms", "1.5", "1e2", "", " 2", "-1", "11", "9007199254740992"])(
    "rejects malformed/out-of-range integer %s",
    (value) => {
      setEnv(key, value);
      expect(() =>
        config.getIntegerEnvVar(key, { min: 0, max: 10, defaultValue: 3 })
      ).toThrow(key);
    }
  );
  it("honors integer boundaries, defaults and invalid default rejection", () => {
    for (const value of ["0", "10"]) {
      setEnv(key, value);
      expect(config.getIntegerEnvVar(key, { min: 0, max: 10 })).toBe(
        Number(value)
      );
    }
    setEnv(key, undefined);
    expect(
      config.getIntegerEnvVar(key, { min: 0, max: 10, defaultValue: 3 })
    ).toBe(3);
    expect(() =>
      config.getIntegerEnvVar(key, { min: 0, max: 10, defaultValue: 11 })
    ).toThrow(key);
  });
  it("validates enums and rejects unknown supplied values without echoing them", () => {
    setEnv(key, undefined);
    expect(config.getEnumEnvVar(key, ["test", "live"] as const, "test")).toBe(
      "test"
    );
    setEnv(key, "live");
    expect(config.getEnumEnvVar(key, ["test", "live"] as const, "test")).toBe(
      "live"
    );
    setEnv(key, "private-invalid-value");
    expect(() =>
      config.getEnumEnvVar(key, ["test", "live"] as const, "test")
    ).toThrow(`Invalid environment variable ${key}`);
  });
  it("uses the explicit log default, accepts established case-insensitive levels, rejects typos", () => {
    setEnv("LOG_LEVEL", undefined);
    expect(config.getLogLevel()).toBe("info");
    setEnv("LOG_LEVEL", "DEBUG");
    expect(config.getLogLevel()).toBe("debug");
    setEnv("LOG_LEVEL", "verbose-private");
    expect(() => config.getLogLevel()).toThrow("LOG_LEVEL");
  });
});

describe("HTTP endpoint settings", () => {
  it.each([
    "file:///private",
    "javascript:private",
    "https://user:private@host.invalid",
    "https://host.invalid/#private",
    " https://host.invalid",
    "https://",
    "",
  ])("rejects unsupported endpoint %s", (value) => {
    setEnv(key, value);
    expect(() => config.getHttpUrlEnvVar(key)).toThrow(
      `Invalid environment variable ${key}`
    );
  });
  it("preserves valid endpoints and permits explicit local HTTP endpoints", () => {
    setEnv(key, "http://localhost:9200/prefix");
    expect(config.getHttpUrlEnvVar(key)).toBe("http://localhost:9200/prefix");
    setEnv(key, undefined);
    expect(config.getHttpUrlEnvVar(key, "https://fixture.invalid")).toBe(
      "https://fixture.invalid"
    );
  });
});

it.each([
  "https://fixture.invalid?",
  "https://fixture.invalid#",
  "https://fixture.invalid/prefix?",
  "https://fixture.invalid/prefix#",
])("rejects even an empty URL delimiter: %s", (value) => {
  setEnv(key, value);
  expect(() => config.getHttpUrlEnvVar(key)).toThrow(
    new Error(`Invalid environment variable ${key}`)
  );
});
it.each([
  "https://fixture.invalid/prefix%3F",
  "https://fixture.invalid/prefix%23",
])("preserves encoded path punctuation: %s", (value) => {
  setEnv(key, value);
  expect(config.getHttpUrlEnvVar(key)).toBe(value);
});
