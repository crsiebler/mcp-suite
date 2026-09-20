import { Pool } from "pg";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PostgreSQLService } from "../../servers/postgresql/src/services/postgresql-service.ts";
import { Logger } from "../../shared/utils/logger.ts";

const empty = { rows: [], rowCount: 0, fields: [] };
const db = { query: vi.fn(), release: vi.fn() };
function mockConnection() {
  return vi.spyOn(Pool.prototype, "connect").mockResolvedValue(db as never);
}
let connect: ReturnType<typeof mockConnection>;
function service(allow = false) {
  return new PostgreSQLService(
    "postgresql://fixture:fixture@localhost/fixture",
    new Logger("error"),
    allow
  );
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubEnv("POSTGRESQL_QUERY_TIMEOUT_MS", "1000");
  vi.stubEnv("POSTGRESQL_MAX_ROWS", "2");
  db.query.mockReset().mockResolvedValue(empty);
  db.release.mockReset();
  connect = mockConnection();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it.each([
  " select $1; ",
  "SELECT 'limit' AS word -- no newline",
  "WITH x AS (SELECT 1) SELECT * FROM x;",
  "SELECT 1 UNION SELECT 2;",
])(
  "passes exact SQL and parameters without appending LIMIT: %s",
  async (sql) => {
    const params = ["fixture"];
    const result = await service().executeQuery(sql, params);
    expect(result.success).toBe(true);
    expect(db.query.mock.calls).toEqual([
      ["BEGIN READ ONLY"],
      [sql, params],
      ["COMMIT"],
    ]);
    expect(db.release.mock.calls).toEqual([[]]);
  }
);

it("caps response rows while retaining database row count and field metadata", async () => {
  const fields = [
    { name: "id", dataTypeID: 23, dataTypeSize: 4, dataTypeModifier: -1 },
  ];
  db.query.mockResolvedValueOnce(empty).mockResolvedValueOnce({
    rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
    rowCount: 3,
    fields,
  });
  const result = await service().executeQuery("SELECT id FROM fixture");
  expect(result).toEqual({
    success: true,
    data: {
      rows: [{ id: 1 }, { id: 2 }],
      rowCount: 3,
      fields,
      truncated: true,
      returnedRowCount: 2,
    },
  });
});

it("preserves the dangerous-operation flag and transaction selection", async () => {
  const readonly = service();
  expect(readonly.isDangerousOperationsAllowed()).toBe(false);
  expect((await readonly.executeQuery("DELETE FROM fixture")).success).toBe(
    false
  );
  expect(db.query).not.toHaveBeenCalled();
  const writable = service(true);
  expect(writable.isDangerousOperationsAllowed()).toBe(true);
  expect((await writable.executeQuery("DELETE FROM fixture")).success).toBe(
    true
  );
  expect(db.query.mock.calls).toEqual([
    ["BEGIN"],
    ["DELETE FROM fixture", undefined],
    ["COMMIT"],
  ]);
});

it("preserves function filtering without making a database call", async () => {
  expect((await service().executeQuery("SELECT pg_sleep(10)")).success).toBe(
    false
  );
  expect(db.query).not.toHaveBeenCalled();
});

it("rolls back ordinary errors and returns a safe failure before releasing", async () => {
  db.query
    .mockResolvedValueOnce(empty)
    .mockRejectedValueOnce(new Error("private-sql-value"));
  const result = await service().executeQuery("SELECT 1");
  expect(result.success).toBe(false);
  expect(JSON.stringify(result)).not.toContain("private-");
  expect(db.query.mock.calls).toEqual([
    ["BEGIN READ ONLY"],
    ["SELECT 1", undefined],
    ["ROLLBACK"],
  ]);
  expect(db.release.mock.calls).toEqual([[]]);
});

it("destroys the client if rollback fails", async () => {
  db.query
    .mockResolvedValueOnce(empty)
    .mockRejectedValueOnce(new Error("query failure"))
    .mockRejectedValueOnce(new Error("rollback failure"));
  expect((await service().executeQuery("SELECT 1")).success).toBe(false);
  expect(db.release.mock.calls).toEqual([[true]]);
});

it.each(["BEGIN READ ONLY", "SELECT 1", "COMMIT"])(
  "bounds a hung %s and never reuses its client",
  async (hung) => {
    db.query.mockImplementation((sql: string) =>
      sql === hung ? new Promise(() => {}) : Promise.resolve(empty)
    );
    const pending = service().executeQuery("SELECT 1");
    await vi.advanceTimersByTimeAsync(1000);
    const result = await pending;
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected failure");
    expect(result.error).toMatch(/timed out/i);
    expect(db.release.mock.calls).toEqual([[true]]);
    expect(db.query.mock.calls.some(([sql]) => sql === "ROLLBACK")).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  }
);

it("bounds rollback independently after an ordinary query failure", async () => {
  db.query
    .mockResolvedValueOnce(empty)
    .mockRejectedValueOnce(new Error("failure"))
    .mockImplementationOnce(() => new Promise(() => {}));
  const pending = service().executeQuery("SELECT 1");
  await vi.advanceTimersByTimeAsync(5000);
  expect((await pending).success).toBe(false);
  expect(db.release.mock.calls).toEqual([[true]]);
  expect(vi.getTimerCount()).toBe(0);
});

it("does not commit a query that resolves after its deadline", async () => {
  let resolveQuery!: (value: typeof empty) => void;
  db.query.mockResolvedValueOnce(empty).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveQuery = resolve;
      })
  );
  const pending = service().executeQuery("SELECT 1");
  await vi.advanceTimersByTimeAsync(1000);
  expect((await pending).success).toBe(false);
  resolveQuery(empty);
  await vi.advanceTimersByTimeAsync(1);
  expect(db.query.mock.calls.map(([sql]) => sql)).toEqual([
    "BEGIN READ ONLY",
    "SELECT 1",
  ]);
  expect(db.release.mock.calls).toEqual([[true]]);
});

it("handles connection failures without leaking their details", async () => {
  connect.mockRejectedValue(new Error("private-connection-string"));
  const result = await service().executeQuery("SELECT 1");
  expect(result.success).toBe(false);
  expect(JSON.stringify(result)).not.toContain("private-");
  expect(db.release).not.toHaveBeenCalled();
});

it("releases a late acquired client after the connection deadline", async () => {
  let resolveClient!: (value: typeof db) => void;
  connect.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveClient = resolve;
      })
  );
  const pending = service().executeQuery("SELECT 1");
  await vi.advanceTimersByTimeAsync(10000);
  expect((await pending).success).toBe(false);
  resolveClient(db);
  await vi.advanceTimersByTimeAsync(1);
  expect(db.release.mock.calls).toEqual([[true]]);
  expect(db.query).not.toHaveBeenCalled();
});

it("shares one deadline across BEGIN, query and COMMIT", async () => {
  db.query.mockImplementation(
    () => new Promise((resolve) => setTimeout(() => resolve(empty), 600))
  );
  const pending = service().executeQuery("SELECT 1");
  await vi.advanceTimersByTimeAsync(1000);
  expect((await pending).success).toBe(false);
  expect(db.release.mock.calls).toEqual([[true]]);
  await vi.advanceTimersByTimeAsync(1000);
  expect(db.query.mock.calls.map(([sql]) => sql)).toEqual([
    "BEGIN READ ONLY",
    "SELECT 1",
  ]);
});

it.each([undefined, "", " ", 123])(
  "rejects malformed query input before acquiring a connection",
  async (input) => {
    expect((await service().executeQuery(input)).success).toBe(false);
    expect(connect).not.toHaveBeenCalled();
  }
);

it("returns an explicit failure and rolls back multiple statement results", async () => {
  db.query.mockResolvedValueOnce(empty).mockResolvedValueOnce([empty, empty]);
  expect((await service().executeQuery("SELECT 1; SELECT 2")).success).toBe(
    false
  );
  expect(db.query.mock.calls.map(([sql]) => sql)).toEqual([
    "BEGIN READ ONLY",
    "SELECT 1; SELECT 2",
    "ROLLBACK",
  ]);
  expect(db.release.mock.calls).toEqual([[]]);
});

it("reports untruncated empty results and clears success timers", async () => {
  expect(await service().executeQuery("SHOW server_version")).toEqual({
    success: true,
    data: { ...empty, truncated: false, returnedRowCount: 0 },
  });
  expect(vi.getTimerCount()).toBe(0);
});
