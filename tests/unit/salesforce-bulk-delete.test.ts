import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SalesforceService } from "../../servers/salesforce/src/services/salesforce-service.ts";
import { Logger } from "../../shared/utils/logger.ts";

const ids = ["001RM000003oLrHYAU", "001RM000003oLraYAE"];
const success = (id: string) => ({ id, success: true, errors: [] });
const failed = {
  success: false,
  errors: [
    { statusCode: "DELETE_FAILED", message: "private-record-data", fields: [] },
  ],
};
const fetchMock = vi.fn();
function service() {
  return new SalesforceService(
    {
      instanceUrl: "https://fixture.invalid",
      accessToken: "fixture-token",
      apiVersion: "v59.0",
    },
    new Logger("error")
  );
}
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function respond(data: unknown) {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => data,
  });
}

it("reports partial failure from the provider's ordered array", async () => {
  respond([success(ids[0]), failed]);
  const result = await service().bulkDelete("Account", ids);
  expect(result.success).toBe(false);
  expect(result.data).toMatchObject({
    allOrNone: false,
    rolledBack: false,
    deletedCount: 1,
    failedCount: 1,
    results: [
      { requestedId: ids[0], success: true },
      {
        requestedId: ids[1],
        success: false,
        errors: [{ statusCode: "DELETE_FAILED" }],
      },
    ],
  });
  expect(JSON.stringify(result)).not.toContain("private-");
  const [url, options] = fetchMock.mock.calls[0];
  expect(options.method).toBe("DELETE");
  expect(new URL(url).searchParams.get("allOrNone")).toBe("false");
  expect(new URL(url).searchParams.get("ids")).toBe(ids.join(","));
});

it("reports successful arrays and defaults to independent deletions", async () => {
  respond(ids.map(success));
  expect(await service().bulkDelete("Account", ids)).toMatchObject({
    success: true,
    data: {
      deletedCount: 2,
      failedCount: 0,
      allOrNone: false,
      rolledBack: false,
    },
  });
});

it("preserves allOrNone rollback reporting", async () => {
  respond([
    {
      id: ids[0],
      success: false,
      errors: [
        {
          statusCode: "ALL_OR_NONE_OPERATION_ROLLED_BACK",
          message: "private-message",
          fields: [],
        },
      ],
    },
    failed,
  ]);
  const result = await service().bulkDelete("Account", ids, true);
  expect(result).toMatchObject({
    success: false,
    data: {
      allOrNone: true,
      rolledBack: true,
      deletedCount: 0,
      failedCount: 2,
    },
  });
  expect(
    new URL(fetchMock.mock.calls[0][0]).searchParams.get("allOrNone")
  ).toBe("true");
});

it.each([
  null,
  {},
  { results: ids.map(success) },
  [],
  [success(ids[0])],
  [{ ...success(ids[0]), success: "true" }, success(ids[1])],
  [success(ids[1]), success(ids[0])],
])("rejects malformed or mismatched responses", async (body) => {
  respond(body);
  const result = await service().bulkDelete("Account", ids);
  expect(result.success).toBe(false);
  expect(result.data).toBeUndefined();
  expect(result.error).toMatch(/response|outcome/i);
});

it("does not invent committed successes from contradictory allOrNone results", async () => {
  respond([success(ids[0]), failed]);
  const result = await service().bulkDelete("Account", ids, true);
  expect(result.success).toBe(false);
  expect(result.data).toBeUndefined();
});

it.each([[], Array(201).fill(ids[0]), ["id&allOrNone=true"], "not-an-array"])(
  "rejects invalid record lists before requesting deletion",
  async (input) => {
    expect(
      (await service().bulkDelete("Account", input as never)).success
    ).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  }
);

it("accepts exactly 200 IDs", async () => {
  const batch = Array.from(
    { length: 200 },
    (_, index) => `001${String(index).padStart(12, "0")}`
  );
  respond(batch.map(success));
  expect((await service().bulkDelete("Account", batch)).success).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("does not expose private network errors or automatically retry them", async () => {
  fetchMock.mockRejectedValue(new Error("private-connection-detail"));
  const result = await service().bulkDelete("Account", ids);
  expect(result.success).toBe(false);
  expect(JSON.stringify(result)).not.toContain("private-");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("compares complete 18-character IDs case-insensitively", async () => {
  respond(ids.map(success));
  expect(
    (
      await service().bulkDelete(
        "Account",
        ids.map((id) => id.toLowerCase())
      )
    ).success
  ).toBe(true);
});

it("does not discard the distinguishing suffix when comparing two 18-character IDs", async () => {
  respond([success(`${ids[0].slice(0, 15)}ZZZ`), success(ids[1])]);
  expect((await service().bulkDelete("Account", ids)).data).toBeUndefined();
});

it("matches 15-character input to a corresponding 18-character provider ID", async () => {
  respond(ids.map(success));
  expect(
    (
      await service().bulkDelete(
        "Account",
        ids.map((id) => id.slice(0, 15))
      )
    ).success
  ).toBe(true);
});

it("rejects string all_or_none values before requesting deletion", async () => {
  expect((await service().bulkDelete("Account", ids, "false")).success).toBe(
    false
  );
  expect(fetchMock).not.toHaveBeenCalled();
});
