import type { PoolConfig } from "pg";
import {
  ConfigurationError,
  getEnumEnvVar,
  getIntegerEnvVar,
} from "../../../shared/utils/config.js";

/** Keep pg's URI parser from replacing explicit TLS/deadline configuration. */
function validateConnectionString(value: string): void {
  try {
    const url = new URL(value);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      /[\s#]/.test(value) ||
      /%(?![0-9a-f]{2})/i.test(value)
    ) {
      throw new Error();
    }
    for (const key of url.searchParams.keys()) {
      if (
        /^ssl/i.test(key) ||
        /^(uselibpqcompat|options|statement_timeout|query_timeout|lock_timeout|idle_in_transaction_session_timeout|connectionTimeoutMillis|connect_timeout)$/i.test(
          key
        )
      ) {
        throw new Error();
      }
    }
  } catch {
    throw new ConfigurationError("POSTGRESQL_CONNECTION_STRING");
  }
}

export function postgresqlConfig(connectionString: string): {
  pool: PoolConfig;
  queryTimeoutMs: number;
  maxRows: number;
} {
  validateConnectionString(connectionString);
  const mode = getEnumEnvVar(
    "POSTGRESQL_SSL_MODE",
    ["verify-full", "disable"] as const,
    "verify-full"
  );
  const ca = process.env.POSTGRESQL_SSL_CA;
  if (ca !== undefined && (!ca.trim() || mode === "disable")) {
    throw new ConfigurationError("POSTGRESQL_SSL_CA");
  }
  const queryTimeoutMs = getIntegerEnvVar("POSTGRESQL_QUERY_TIMEOUT_MS", {
    min: 1,
    max: 300000,
    defaultValue: 30000,
  });
  const maxRows = getIntegerEnvVar("POSTGRESQL_MAX_ROWS", {
    min: 1,
    max: 10000,
    defaultValue: 100,
  });
  return {
    pool: {
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      statement_timeout: queryTimeoutMs,
      ssl:
        mode === "disable"
          ? false
          : { rejectUnauthorized: true, ...(ca === undefined ? {} : { ca }) },
    },
    queryTimeoutMs,
    maxRows,
  };
}
