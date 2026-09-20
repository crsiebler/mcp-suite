import type { Pool, PoolClient, QueryResult } from "pg";
import type { Logger } from "../../../../shared/utils/logger.js";

class QueryDeadline extends Error {}

async function within<T>(
  operation: () => Promise<T>,
  milliseconds: number
): Promise<T> {
  if (milliseconds <= 0) throw new QueryDeadline();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new QueryDeadline()), milliseconds);
      }),
      operation(),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function acquire(pool: Pool): Promise<PoolClient> {
  let expired = false;
  try {
    return await within(
      () =>
        pool.connect().then((client) => {
          if (expired) {
            client.release(true);
            throw new QueryDeadline();
          }
          return client;
        }),
      10000
    );
  } catch (error) {
    expired = true;
    throw error;
  }
}

export type DatabaseResponse =
  | {
      success: true;
      data: {
        rows: unknown[];
        rowCount: number;
        fields: {
          name: string;
          dataTypeID: number;
          dataTypeSize: number;
          dataTypeModifier: number;
        }[];
        truncated: boolean;
        returnedRowCount: number;
      };
    }
  | { success: false; error: string };

/** Own one checked-out client through completion or destructive release. */
export async function executeTransaction(
  pool: Pool,
  logger: Logger,
  query: string,
  params: unknown[] | undefined,
  readOnly: boolean,
  timeoutMs: number,
  maxRows: number
): Promise<DatabaseResponse> {
  let client: PoolClient | undefined;
  let begun = false;
  let discard = false;
  let committing = false;
  try {
    client = await acquire(pool);
    const expiresAt = Date.now() + timeoutMs;
    const run = <T>(operation: () => Promise<T>) =>
      within(operation, expiresAt - Date.now());
    await run(() => client!.query(readOnly ? "BEGIN READ ONLY" : "BEGIN"));
    begun = true;
    const result: QueryResult = await run(() => client!.query(query, params));
    // Multiple-statement results never had a usable single-result contract.
    if (Array.isArray(result) || !Array.isArray(result.rows)) throw new Error();
    const rows: unknown[] = result.rows.slice(0, maxRows);
    const data = {
      rows,
      rowCount: result.rowCount ?? 0,
      fields: result.fields.map(
        ({ name, dataTypeID, dataTypeSize, dataTypeModifier }) => ({
          name,
          dataTypeID,
          dataTypeSize,
          dataTypeModifier,
        })
      ),
      truncated: result.rows.length > rows.length,
      returnedRowCount: rows.length,
    };
    committing = true;
    await run(() => client!.query("COMMIT"));
    return { success: true, data };
  } catch (error) {
    logger.error("Error executing query", error);
    discard = error instanceof QueryDeadline || !begun || committing;
    if (client && !discard) {
      try {
        await within(() => client!.query("ROLLBACK"), 5000);
      } catch (rollbackError) {
        discard = true;
        logger.error("Error rolling back transaction", rollbackError);
      }
    }
    return {
      success: false,
      error:
        error instanceof QueryDeadline
          ? "Database operation timed out. Its outcome may be unknown; verify before retrying."
          : "Database operation failed. Its outcome may be unknown; verify before retrying.",
    };
  } finally {
    // pg destroys the active socket on release(true), rather than queuing rollback
    // behind a hung query. Server cancellation timing is not guaranteed by this.
    if (discard) client?.release(true);
    else client?.release();
  }
}
