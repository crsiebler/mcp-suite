import type { SalesforceBulkDeleteResponse } from "../types/salesforce.js";

export function isRecordId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^(?:[A-Za-z0-9]{15}|[A-Za-z0-9]{18})$/.test(value)
  );
}
function sameRecord(left: string, right: string): boolean {
  return left.length === 18 && right.length === 18
    ? left.toLowerCase() === right.toLowerCase()
    : left.slice(0, 15) === right.slice(0, 15);
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The standalone Collections DELETE response is ordered like the requested IDs. */
export function bulkDeleteResult(
  response: unknown,
  ids: string[],
  allOrNone: boolean
): SalesforceBulkDeleteResponse | undefined {
  if (!Array.isArray(response) || response.length !== ids.length)
    return undefined;
  const results: SalesforceBulkDeleteResponse["results"] = [];
  for (let index = 0; index < response.length; index++) {
    const row: unknown = response[index];
    if (
      !object(row) ||
      typeof row.success !== "boolean" ||
      !Array.isArray(row.errors)
    )
      return undefined;
    if (
      row.id !== undefined &&
      row.id !== null &&
      (!isRecordId(row.id) || !sameRecord(row.id, ids[index]))
    )
      return undefined;
    if (row.success && (!isRecordId(row.id) || row.errors.length !== 0))
      return undefined;
    if (!row.success && row.errors.length === 0) return undefined;
    const errors: { statusCode: string }[] = [];
    for (const error of row.errors as unknown[]) {
      if (
        !object(error) ||
        typeof error.statusCode !== "string" ||
        !/^[A-Z][A-Z0-9_]{0,79}$/.test(error.statusCode)
      )
        return undefined;
      // Provider messages can contain record values. Return actionable codes only.
      errors.push({ statusCode: error.statusCode });
    }
    results.push({
      requestedId: ids[index],
      ...(row.id === undefined ? {} : { id: row.id as string | null }),
      success: row.success,
      errors,
    });
  }
  const deletedCount = results.filter((row) => row.success).length;
  const failedCount = results.length - deletedCount;
  // A standalone allOrNone request cannot commit a subset. Don't fabricate results.
  if (allOrNone && deletedCount > 0 && failedCount > 0) return undefined;
  return {
    results,
    allOrNone,
    rolledBack: allOrNone && failedCount > 0,
    deletedCount,
    failedCount,
  };
}
