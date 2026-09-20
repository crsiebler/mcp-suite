/** Keep machine error types, never provider reasons or nested document values. */
export function errorType(error: unknown): { type: string } {
  const type =
    error !== null && typeof error === "object" && "type" in error
      ? error.type
      : undefined;
  return {
    type:
      typeof type === "string" && /^[a-z][a-z0-9_]{0,99}$/.test(type)
        ? type
        : "provider_error",
  };
}

export function operationFailures(failures: unknown): unknown {
  if (failures === undefined) return undefined;
  if (!Array.isArray(failures)) throw new Error("Invalid provider failures");
  return failures.map((item) => ({
    index: typeof item?.index === "string" ? item.index : undefined,
    id: typeof item?.id === "string" ? item.id : undefined,
    status: typeof item?.status === "number" ? item.status : undefined,
    cause: errorType(item?.cause),
  }));
}

export interface ShardOutcome {
  total: number;
  successful: number;
  failed: number;
  skipped?: number;
  failures?: Array<{ reason: { type: string } }>;
}

/** Project read outcomes without copying nested provider reasons. */
export function shardOutcome(value: unknown): ShardOutcome | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object")
    throw new Error("Invalid shard metadata");
  const shards = value as Record<string, unknown>;
  for (const key of [
    "total",
    "successful",
    "failed",
    ...(shards.skipped === undefined ? [] : ["skipped"]),
  ]) {
    if (
      typeof shards[key] !== "number" ||
      !Number.isSafeInteger(shards[key]) ||
      shards[key] < 0
    )
      throw new Error("Invalid shard count");
  }
  if (shards.failures !== undefined && !Array.isArray(shards.failures))
    throw new Error("Invalid shard failures");
  return {
    total: shards.total as number,
    successful: shards.successful as number,
    failed: shards.failed as number,
    ...(shards.skipped === undefined
      ? {}
      : { skipped: shards.skipped as number }),
    ...(Array.isArray(shards.failures)
      ? {
          failures: shards.failures.map((item) => ({
            reason: errorType(item?.reason),
          })),
        }
      : {}),
  };
}
