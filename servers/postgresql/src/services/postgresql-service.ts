import { Pool } from "pg";
import { Logger } from "../../../../shared/utils/logger.js";
import { postgresqlConfig } from "../config.js";
import {
  executeTransaction,
  type DatabaseResponse,
} from "./query-execution.js";

export class PostgreSQLService {
  private pool: Pool;
  private queryTimeoutMs: number;
  private maxRows: number;
  private logger: Logger;
  private allowDangerousOperations: boolean;

  constructor(
    connectionString: string,
    logger: Logger,
    allowDangerousOperations: boolean = false
  ) {
    this.logger = logger;
    this.allowDangerousOperations = allowDangerousOperations;
    const config = postgresqlConfig(connectionString);
    this.pool = new Pool(config.pool);
    this.queryTimeoutMs = config.queryTimeoutMs;
    this.maxRows = config.maxRows;

    this.pool.on("error", (err: Error) => {
      this.logger.error("Unexpected PostgreSQL client error", err);
    });
  }

  async executeQuery(
    query: unknown,
    params?: unknown
  ): Promise<DatabaseResponse> {
    if (
      typeof query !== "string" ||
      !query.trim() ||
      (params !== undefined &&
        (!Array.isArray(params) ||
          params.some((value) => typeof value !== "string")))
    ) {
      return {
        success: false,
        error:
          "query must be nonblank text and params must be an array of strings.",
      };
    }
    this.logger.info("Executing database query");
    const lowerQuery = query.trim().toLowerCase();
    // Enhanced safety checks - only allow SELECT statements and utility commands unless dangerous operations are enabled
    if (!this.allowDangerousOperations && !this.isReadOnlyQuery(lowerQuery)) {
      return {
        success: false,
        error:
          "Only read-only queries are allowed. Permitted operations: SELECT, SHOW, DESCRIBE, EXPLAIN. Set allowDangerousOperations to true to enable write operations.",
      };
    }

    // Additional safety: Check for dangerous functions and procedures (unless dangerous operations are allowed)
    if (!this.allowDangerousOperations) {
      const dangerousFunctions = [
        "pg_sleep",
        "pg_terminate_backend",
        "pg_cancel_backend",
        "current_setting",
        "set_config",
        "pg_reload_conf",
        "pg_rotate_logfile",
        "pg_stat_file",
        "pg_read_file",
        "copy",
        "lo_",
        "dblink",
        "file_fdw",
      ];

      const hasDangerousFunction = dangerousFunctions.some((func) =>
        lowerQuery.includes(func.toLowerCase())
      );

      if (hasDangerousFunction) {
        return {
          success: false,
          error:
            "Query contains potentially dangerous functions. Only safe read operations are allowed.",
        };
      }
    }

    return executeTransaction(
      this.pool,
      this.logger,
      query,
      params as string[] | undefined,
      !(this.allowDangerousOperations && !this.isReadOnlyQuery(lowerQuery)),
      this.queryTimeoutMs,
      this.maxRows
    );
  }

  private isReadOnlyQuery(query: string): boolean {
    const allowedOperations = [
      "select",
      "show",
      "describe",
      "desc",
      "explain",
      "with", // Common Table Expressions for complex SELECT queries
    ];

    // Check if query starts with allowed operations
    const startsWithAllowed = allowedOperations.some(
      (op) => query.startsWith(op + " ") || query === op
    );

    if (!startsWithAllowed) {
      return false;
    }

    // Block dangerous keywords even in SELECT contexts
    const dangerousKeywords = [
      "drop",
      "delete",
      "insert",
      "update",
      "create",
      "alter",
      "truncate",
      "grant",
      "revoke",
      "commit",
      "rollback",
      "savepoint",
      "release",
      "lock",
      "unlock",
      "call",
      "exec",
    ];

    const hasDangerousKeyword = dangerousKeywords.some((keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, "i");
      return regex.test(query);
    });

    return !hasDangerousKeyword;
  }

  isDangerousOperationsAllowed(): boolean {
    return this.allowDangerousOperations;
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();

      this.logger.info("Disconnected from PostgreSQL database");
    } catch (err) {
      this.logger.error("Error disconnecting from PostgreSQL database", err);
    }
  }
}
