import { Client, Pool } from "pg";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PostgreSQLService } from "../../servers/postgresql/src/services/postgresql-service.ts";
import { Logger } from "../../shared/utils/logger.ts";

const connectionString = "postgresql://fixture:fixture@localhost:5432/fixture";
const keys = [
  "POSTGRESQL_SSL_MODE",
  "POSTGRESQL_SSL_CA",
  "POSTGRESQL_QUERY_TIMEOUT_MS",
  "POSTGRESQL_MAX_ROWS",
  "PGSSLMODE",
];
beforeEach(() => {
  for (const key of keys) {
    vi.stubEnv(key, "");
    delete process.env[key];
  }
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

// Real pool/client construction parses configuration but never opens a socket.
function configuredPool(uri = connectionString) {
  const on = vi.spyOn(Pool.prototype, "on");
  new PostgreSQLService(uri, new Logger("error"));
  return on.mock.instances[0] as Pool;
}

it("requires certificate verification even if PGSSLMODE requests no verification", () => {
  vi.stubEnv("PGSSLMODE", "no-verify");
  const pool = configuredPool();
  const client = new Client(pool.options);
  expect(client.ssl).toEqual({ rejectUnauthorized: true });
  expect(pool.options.statement_timeout).toBe(30000);
  expect(pool.options.connectionTimeoutMillis).toBe(10000);
});

it("supports explicit local non-TLS connections", () => {
  vi.stubEnv("POSTGRESQL_SSL_MODE", "disable");
  expect(new Client(configuredPool().options).ssl).toBe(false);
});

it("passes a supplied trusted CA without disabling hostname verification", () => {
  vi.stubEnv("POSTGRESQL_SSL_CA", "fixture-ca-pem");
  expect(new Client(configuredPool().options).ssl).toEqual({
    rejectUnauthorized: true,
    ca: "fixture-ca-pem",
  });
});

it.each([
  ["POSTGRESQL_SSL_MODE", "no-verify"],
  ["POSTGRESQL_SSL_MODE", ""],
  ["POSTGRESQL_SSL_CA", " "],
  ["POSTGRESQL_QUERY_TIMEOUT_MS", "0"],
  ["POSTGRESQL_QUERY_TIMEOUT_MS", "300001"],
  ["POSTGRESQL_QUERY_TIMEOUT_MS", "1.2"],
  ["POSTGRESQL_MAX_ROWS", "0"],
  ["POSTGRESQL_MAX_ROWS", "10001"],
])("rejects invalid %s without exposing values", (key, value) => {
  vi.stubEnv(key, value);
  expect(() => configuredPool()).toThrow(`Invalid environment variable ${key}`);
});

it("rejects a CA combined with disabled TLS instead of ignoring it", () => {
  vi.stubEnv("POSTGRESQL_SSL_MODE", "disable");
  vi.stubEnv("POSTGRESQL_SSL_CA", "fixture-ca");
  expect(() => configuredPool()).toThrow("POSTGRESQL_SSL_CA");
});

it.each([
  "sslmode=no-verify",
  "ssl=false",
  "sslrootcert=private-path",
  "sslcert=private-path",
  "sslkey=private-path",
  "uselibpqcompat=true",
  "statement_timeout=0",
  "query_timeout=0",
  "options=-c%20statement_timeout%3D0",
  "connectionTimeoutMillis=0",
  "connect_timeout=0",
])("rejects URI overrides of managed connection safeguards: %s", (query) => {
  expect(() => configuredPool(`${connectionString}?${query}`)).toThrow(
    "Invalid environment variable POSTGRESQL_CONNECTION_STRING"
  );
});

it("preserves the URI and ordinary application name options", () => {
  const uri = `${connectionString}?application_name=fixture`;
  vi.stubEnv("POSTGRESQL_QUERY_TIMEOUT_MS", "1000");
  const pool = configuredPool(uri);
  expect(pool.options.connectionString).toBe(uri);
  expect(pool.options.statement_timeout).toBe(1000);
});
