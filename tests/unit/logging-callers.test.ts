import axios from "axios";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Logger } from "../../shared/utils/logger.ts";
import { PostgreSQLService } from "../../servers/postgresql/src/services/postgresql-service.ts";
import { SalesforceService } from "../../servers/salesforce/src/services/salesforce-service.ts";
import { DuffelService } from "../../servers/flight/src/services/duffel-service.ts";

const db = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
}));
vi.mock("pg", () => ({
  Pool: class {
    on() {}
    async connect() {
      return db;
    }
  },
}));
const logger = () => new Logger("debug", { server: "fixture" });
const output = () => vi.mocked(console.error).mock.calls.flat().join("\n");

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  db.query.mockResolvedValue({ rows: [], rowCount: 0, fields: [] });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("omits raw SQL and parameters while preserving query execution", async () => {
  const service = new PostgreSQLService(
    "postgresql://fixture.invalid",
    logger()
  );
  const result = await service.executeQuery("select 'private-sql'", [
    "private-parameter",
  ]);
  expect(result.success).toBe(true);
  expect(db.query).toHaveBeenCalledWith("select 'private-sql'", [
    "private-parameter",
  ]);
  expect(output()).toContain("Executing");
  expect(output()).not.toContain("private-");
});

it("omits Salesforce provider errors and request URLs from diagnostics", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("private-provider-detail"))
  );
  const service = new SalesforceService(
    {
      instanceUrl: "https://fixture.invalid",
      accessToken: "synthetic-token",
      apiVersion: "v59.0",
    },
    logger()
  );
  const result = await service.query("SELECT private-field FROM Account");
  expect(result.success).toBe(false);
  expect(output()).toContain("Salesforce API request failed");
  expect(output()).not.toContain("private-");
});

it("omits Duffel URL query content on requests and responses", async () => {
  const client = axios.create({
    adapter: async (config) => ({
      data: { data: [] },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    }),
  });
  vi.spyOn(axios, "create").mockReturnValue(client);
  new DuffelService(
    { apiKey: "synthetic-token", environment: "test" },
    logger()
  );
  await client.get("/air/airlines?filter=private-filter");
  expect(output()).toContain("Duffel API");
  expect(output()).not.toContain("private-");
});

it("keeps Canvas bulk-operation failures out of diagnostics", async () => {
  const { EnrollmentService } =
    await import("../../servers/canvas/src/services/enrollment-service.ts");
  const client = axios.create({
    adapter: async () => {
      throw new Error("private-enrollment-error");
    },
  });
  const service = new EnrollmentService(client);
  expect(
    await service.bulkCreateEnrollments("course", "fixture", [
      { user_id: "private-user", type: "StudentEnrollment" },
    ])
  ).toEqual([]);
  expect(
    await service.removeEnrollments("fixture", ["private-enrollment"])
  ).toEqual([]);
  expect(output()).not.toContain("private-");
});
