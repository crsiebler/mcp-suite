import { errors } from "@elastic/elasticsearch";
import { expect, it, vi } from "vitest";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { handleElasticsearchTool } from "../../servers/elasticsearch/src/handler.ts";
import { tools } from "../../servers/elasticsearch/src/tools/index.ts";
import type { ElasticsearchService } from "../../servers/elasticsearch/src/services/elasticsearch-service.ts";
const cases = [
  ["test_connection", "testConnection", {}, []],
  ["cluster_health", "getClusterHealth", {}, []],
  ["node_stats", "getNodeStats", {}, []],
  ["list_indices", "listIndices", {}, []],
  ["get_index_info", "getIndexInfo", { index: "docs" }, ["docs"]],
  [
    "create_index",
    "createIndex",
    { index: "docs", mappings: {}, settings: {} },
    [{ index: "docs", mappings: {}, settings: {} }],
  ],
  ["delete_index", "deleteIndex", { index: "docs" }, ["docs"]],
  ["index_exists", "indexExists", { index: "docs" }, ["docs"]],
  [
    "search",
    "search",
    {
      index: "docs",
      size: 0,
      from: 1,
      query: {},
      sort: [],
      _source: false,
      highlight: {},
      aggs: {},
      track_total_hits: false,
    },
    [
      {
        index: "docs",
        size: 0,
        from: 1,
        query: {},
        sort: [],
        _source: false,
        highlight: {},
        aggs: {},
        track_total_hits: false,
      },
    ],
  ],
  ["count", "count", { index: "docs", query: {} }, ["docs", {}]],
  [
    "aggregation",
    "performAggregation",
    { index: "docs", aggs: {}, size: 0 },
    [{ index: "docs", aggs: {}, size: 0, query: undefined }],
  ],
  ["get_document", "getDocument", { index: "docs", id: "1" }, ["docs", "1"]],
  [
    "index_document",
    "indexDocument",
    { index: "docs", id: "1", document: {}, refresh: false },
    [{ index: "docs", id: "1", document: {}, refresh: false }],
  ],
  [
    "update_document",
    "updateDocument",
    { index: "docs", id: "1", document: {}, refresh: false },
    ["docs", "1", {}, false],
  ],
  [
    "delete_document",
    "deleteDocument",
    { index: "docs", id: "1", refresh: false },
    ["docs", "1", false],
  ],
  [
    "bulk_operation",
    "bulkOperation",
    { index: "docs", operations: [{ action: "delete", id: "1" }] },
    [
      {
        index: "docs",
        operations: [{ action: "delete", id: "1" }],
        refresh: undefined,
      },
    ],
  ],
  [
    "delete_by_query",
    "deleteByQuery",
    { index: "docs", query: {}, refresh: false },
    ["docs", {}, false],
  ],
  [
    "reindex",
    "reindex",
    { source_index: "docs", dest_index: "copy", query: {} },
    ["docs", "copy", {}],
  ],
] as const;
function fake(method: string, value: unknown = {}) {
  const call = vi.fn().mockResolvedValue(value);
  return {
    call,
    service: { [method]: call } as unknown as ElasticsearchService,
  };
}
function text(result: unknown) {
  const parsed = CallToolResultSchema.parse(result);
  const content = parsed.content[0];
  if (content.type !== "text") throw new Error("Expected text");
  return { ...parsed, data: JSON.parse(content.text) };
}
it("advertises exactly the eighteen dispatch contracts with mutation annotations", () => {
  expect(tools.map((t) => t.name).sort()).toEqual(
    cases.map((c) => `elasticsearch_${c[0]}`).sort()
  );
  const writes = [
    "create_index",
    "delete_index",
    "index_document",
    "update_document",
    "delete_document",
    "bulk_operation",
    "delete_by_query",
    "reindex",
  ];
  for (const tool of tools) {
    expect(tool.annotations).toMatchObject({
      readOnlyHint: !writes.includes(tool.name.replace("elasticsearch_", "")),
    });
    if (writes.includes(tool.name.replace("elasticsearch_", "")))
      expect(tool.annotations).toMatchObject({
        destructiveHint: tool.name !== "elasticsearch_create_index",
        idempotentHint: false,
      });
  }
});
it.each(cases)("dispatches %s to %s", async (name, method, args, expected) => {
  const { call, service } = fake(
    method,
    method === "indexExists" ? false : { fixture: true }
  );
  const result = text(
    await handleElasticsearchTool(service, `elasticsearch_${name}`, args)
  );
  expect(call).toHaveBeenCalledTimes(1);
  expect(call).toHaveBeenCalledWith(...expected);
  expect(result.isError).not.toBe(true);
  expect(result.data).toEqual(
    method === "indexExists" ? { exists: false } : { fixture: true }
  );
});
it.each([
  ["search", { index: "docs", size: -1 }],
  ["search", { index: "docs", size: 1001 }],
  ["search", { index: "docs", size: 1.5 }],
  ["search", { index: "docs", from: -1 }],
  ["search", { index: "docs", _source: "wrong" }],
  ["search", { index: "docs", query: [] }],
  ["search", { index: "docs", track_total_hits: "false" }],
  ["search", { index: " " }],
  ["aggregation", { index: "docs", aggs: {}, size: 101 }],
  ["update_document", { index: "docs", id: "1" }],
  ["delete_document", { index: "docs", id: "1", refresh: "true" }],
  ["bulk_operation", { index: "docs", operations: [] }],
  [
    "bulk_operation",
    {
      index: "docs",
      operations: Array(101).fill({ action: "delete", id: "1" }),
    },
  ],
  [
    "bulk_operation",
    { index: "docs", operations: [{ action: "update", id: "1" }] },
  ],
  ["bulk_operation", { index: "docs", operations: [{ action: "delete" }] }],
  [
    "bulk_operation",
    { index: "docs", operations: [{ action: "unknown", document: {} }] },
  ],
  ["delete_by_query", { index: "docs" }],
  ["reindex", { source_index: "docs", dest_index: " " }],
])("rejects malformed %s input before provider calls", async (suffix, args) => {
  const service = new Proxy(
    {},
    {
      get: () => {
        throw new Error("Unexpected provider call");
      },
    }
  ) as ElasticsearchService;
  const result = text(
    await handleElasticsearchTool(service, `elasticsearch_${suffix}`, args)
  );
  expect(result.isError).toBe(true);
  expect(result.data).toMatchObject({
    success: false,
    error: { code: "invalid_input" },
  });
});
it("rejects unknown tool names without reflecting private input", async () => {
  const result = text(
    await handleElasticsearchTool(
      {} as ElasticsearchService,
      "private-secret",
      {}
    )
  );
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result)).not.toContain("private-secret");
});
it.each([
  [
    "bulk_operation",
    "bulkOperation",
    { index: "docs", operations: [{ action: "delete", id: "1" }] },
    { errors: true, items: [] },
  ],
  [
    "delete_by_query",
    "deleteByQuery",
    { index: "docs", query: {} },
    { failures: [{ status: 409 }] },
  ],
  [
    "reindex",
    "reindex",
    { source_index: "docs", dest_index: "copy" },
    { timed_out: true },
  ],
  ["search", "search", { index: "docs" }, { timed_out: true }],
])("flags partial outcomes for %s", async (name, method, args, value) => {
  const { service } = fake(method, value);
  const result = text(
    await handleElasticsearchTool(service, `elasticsearch_${name}`, args)
  );
  expect(result.isError).toBe(true);
  expect(result.data).toEqual(value);
});

it.each([
  [401, "authentication"],
  [403, "forbidden"],
  [404, "not_found"],
  [429, "rate_limited"],
  [503, "unavailable"],
] as const)(
  "classifies real Elastic HTTP %s errors safely",
  async (status, code) => {
    const { call, service } = fake("getClusterHealth");
    call.mockRejectedValue(
      new errors.ResponseError({
        statusCode: status,
        body: { error: { type: "private-provider-text" } },
        headers: { "retry-after": "12" },
        warnings: null,
        meta: {} as never,
      })
    );
    const result = text(
      await handleElasticsearchTool(service, "elasticsearch_cluster_health", {})
    );
    expect(result.isError).toBe(true);
    expect(result.data).toMatchObject({ success: false, error: { code } });
    if (status === 429 || status === 503)
      expect(result.data.error.retryAfterSeconds).toBe(12);
    expect(JSON.stringify(result)).not.toContain("private-provider-text");
  }
);
it.each([
  [new errors.TimeoutError("private-provider-text"), "timeout"],
  [new errors.ConnectionError("private-provider-text"), "unavailable"],
  [new Error("private-provider-text"), "internal_error"],
] as const)(
  "classifies transport failure without raw messages",
  async (error, code) => {
    const { call, service } = fake("getClusterHealth");
    call.mockRejectedValue(error);
    const result = text(
      await handleElasticsearchTool(service, "elasticsearch_cluster_health", {})
    );
    expect(result.isError).toBe(true);
    expect(result.data.error.code).toBe(code);
    expect(JSON.stringify(result)).not.toContain("private-provider-text");
  }
);
it("advertises runtime bounds and required bulk fields", () => {
  const schema = (suffix: string) =>
    tools.find((t) => t.name === `elasticsearch_${suffix}`)!.inputSchema;
  expect(schema("search").properties).toMatchObject({
    size: { type: "integer", minimum: 0, maximum: 1000 },
    from: { type: "integer", minimum: 0 },
    _source: { anyOf: expect.any(Array) },
  });
  expect(schema("aggregation").properties).toMatchObject({
    size: { type: "integer", minimum: 0, maximum: 100 },
  });
  expect(schema("bulk_operation").properties).toMatchObject({
    operations: {
      minItems: 1,
      maxItems: 100,
      items: {
        required: ["action"],
        allOf: [
          {
            if: { properties: { action: { enum: ["update", "delete"] } } },
            then: { required: ["id"] },
          },
          {
            if: {
              properties: { action: { enum: ["index", "create", "update"] } },
            },
            then: { required: ["document"] },
          },
        ],
      },
    },
  });
});
it.each(cases.filter((c) => Object.keys(c[2]).length > 0))(
  "rejects missing required fields for %s",
  async (name, method) => {
    const { call, service } = fake(method);
    const result = text(
      await handleElasticsearchTool(service, `elasticsearch_${name}`, {})
    );
    expect(result.data.error.code).toBe("invalid_input");
    expect(call).not.toHaveBeenCalled();
  }
);
it("accepts the maximum bulk request and aggregation page size", async () => {
  const bulk = fake("bulkOperation", { errors: false, items: [] });
  expect(
    text(
      await handleElasticsearchTool(
        bulk.service,
        "elasticsearch_bulk_operation",
        {
          index: "docs",
          operations: Array.from({ length: 100 }, (_, i) => ({
            action: "delete",
            id: String(i),
          })),
        }
      )
    ).isError
  ).toBe(false);
  const agg = fake("performAggregation", {
    hits: { hits: [] },
    aggregations: {},
  });
  expect(
    text(
      await handleElasticsearchTool(agg.service, "elasticsearch_aggregation", {
        index: "docs",
        aggs: {},
        size: 100,
      })
    ).isError
  ).toBe(false);
});
