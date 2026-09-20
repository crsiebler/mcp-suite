import { handleElasticsearchTool } from "../../servers/elasticsearch/src/handler.ts";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { beforeEach, expect, it, vi } from "vitest";
import { ElasticsearchService } from "../../servers/elasticsearch/src/services/elasticsearch-service.ts";
const client = vi.hoisted(() => ({
  info: vi.fn(),
  search: vi.fn(),
  bulk: vi.fn(),
  get: vi.fn(),
  count: vi.fn(),
  index: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  deleteByQuery: vi.fn(),
  reindex: vi.fn(),
  indices: {
    exists: vi.fn(),
    stats: vi.fn(),
    getMapping: vi.fn(),
    getSettings: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  cat: { indices: vi.fn() },
  cluster: { health: vi.fn() },
  nodes: { stats: vi.fn() },
}));
vi.mock("@elastic/elasticsearch", async () => {
  const actual = await vi.importActual<typeof import("@elastic/elasticsearch")>(
    "@elastic/elasticsearch"
  );
  return {
    errors: actual.errors,
    Client: class {
      constructor() {
        return client;
      }
    },
  };
});

const service = new ElasticsearchService({
  node: "http://fixture.invalid",
  maxRetries: 0,
});
beforeEach(() => {
  for (const value of Object.values(client)) {
    if (typeof value === "function") value.mockReset();
    else Object.values(value).forEach((mock) => mock.mockReset());
  }
});
it("preserves zero hits, disabled total tracking and null scores", async () => {
  client.search.mockResolvedValue({
    took: 1,
    timed_out: false,
    hits: { max_score: null, hits: [] },
    aggregations: { tags: { buckets: [] } },
  });
  const result = await service.search({
    index: "docs",
    size: 0,
    from: 20,
    track_total_hits: false,
    _source: false,
    query: { match_all: {} },
    aggs: { tags: { terms: { field: "tag" } } },
  });
  expect(client.search).toHaveBeenCalledWith(
    expect.objectContaining({
      size: 0,
      from: 20,
      body: expect.objectContaining({
        track_total_hits: false,
        _source: false,
      }),
    })
  );
  expect(result.hits).toEqual({ total: null, max_score: null, hits: [] });
  expect(result.aggregations).toEqual({ tags: { buckets: [] } });
});
it("preserves lower-bound totals and paginated sorted hits", async () => {
  client.search.mockResolvedValue({
    took: 2,
    timed_out: false,
    hits: {
      total: { value: 10000, relation: "gte" },
      max_score: null,
      hits: [{ _index: "docs", _id: "1", _score: null, _source: { tag: "a" } }],
    },
  });
  const result = await service.search({
    index: "docs",
    size: 2,
    from: 4,
    sort: [{ tag: "asc" }],
    highlight: { fields: { tag: {} } },
  });
  expect(client.search).toHaveBeenCalledWith(
    expect.objectContaining({
      size: 2,
      from: 4,
      body: { sort: [{ tag: "asc" }], highlight: { fields: { tag: {} } } },
    })
  );
  expect(result.hits.total).toEqual({ value: 10000, relation: "gte" });
  expect(result.hits.hits[0]._score).toBeNull();
});
it("wraps bulk partial updates but not index/create documents", async () => {
  client.bulk.mockResolvedValue({ took: 1, errors: false, items: [] });
  await service.bulkOperation({
    index: "docs",
    refresh: false,
    operations: [
      { action: "update", id: "1", document: { title: "new" } },
      { action: "index", document: { title: "index" } },
      { action: "create", id: "2", document: {} },
      { action: "delete", id: "3" },
    ],
  });
  expect(client.bulk).toHaveBeenCalledWith({
    body: [
      { update: { _index: "docs", _id: "1" } },
      { doc: { title: "new" } },
      { index: { _index: "docs" } },
      { title: "index" },
      { create: { _index: "docs", _id: "2" } },
      {},
      { delete: { _index: "docs", _id: "3" } },
    ],
    refresh: false,
  });
});
it("does not turn authorization or connection failure into index absence", async () => {
  const error = { statusCode: 403, message: "private provider details" };
  client.indices.exists.mockRejectedValue(error);
  await expect(service.indexExists("docs")).rejects.toBe(error);
  client.indices.exists.mockResolvedValue(false);
  expect(await service.indexExists("missing")).toBe(false);
});
it("preserves the original index-info error for safe classification", async () => {
  const error = { statusCode: 429 };
  client.indices.stats.mockRejectedValue(error);
  await expect(service.getIndexInfo("docs")).rejects.toBe(error);
});
it("returns index information for an alias resolving to a concrete index", async () => {
  client.indices.stats.mockResolvedValue({
    indices: { "docs-1": { total: {} } },
  });
  client.indices.getMapping.mockResolvedValue({
    "docs-1": { mappings: { properties: {} } },
  });
  client.indices.getSettings.mockResolvedValue({
    "docs-1": { settings: { index: {} } },
  });
  expect(await service.getIndexInfo("docs")).toEqual({
    indices: {
      "docs-1": {
        stats: { total: {} },
        mappings: { properties: {} },
        settings: { index: {} },
      },
    },
  });
});
it("returns requested aggregation hits rather than silently discarding them", async () => {
  const hits = {
    total: { value: 1, relation: "eq" },
    max_score: null,
    hits: [{ _id: "1" }],
  };
  client.search.mockResolvedValue({
    took: 1,
    timed_out: false,
    hits,
    aggregations: {},
  });
  expect(
    await service.performAggregation({
      index: "docs",
      aggs: {},
      size: 1,
      query: { match_all: {} },
    })
  ).toMatchObject({ hits });
  expect(client.search).toHaveBeenCalledWith({
    index: "docs",
    size: 1,
    body: { aggs: {}, query: { match_all: {} } },
  });
});
it("maps document CRUD and explicit false refresh", async () => {
  const result = { _index: "docs", _id: "1", _version: 1, result: "updated" };
  client.index.mockResolvedValue(result);
  client.update.mockResolvedValue(result);
  client.delete.mockResolvedValue(result);
  expect(
    await service.indexDocument({
      index: "docs",
      id: "1",
      document: {},
      refresh: false,
    })
  ).toEqual(result);
  expect(client.index).toHaveBeenCalledWith({
    index: "docs",
    id: "1",
    body: {},
    refresh: false,
  });
  await service.updateDocument("docs", "1", { title: "new" }, false);
  expect(client.update).toHaveBeenCalledWith({
    index: "docs",
    id: "1",
    body: { doc: { title: "new" } },
    refresh: false,
  });
  await service.deleteDocument("docs", "1", false);
  expect(client.delete).toHaveBeenCalledWith({
    index: "docs",
    id: "1",
    refresh: false,
  });
});
it("maps bounded deletion and reindex query without live writes", async () => {
  client.deleteByQuery.mockResolvedValue({ deleted: 0, failures: [] });
  client.reindex.mockResolvedValue({ created: 0, failures: [] });
  const query = { term: { tag: "a" } };
  await service.deleteByQuery("docs", query, false);
  expect(client.deleteByQuery).toHaveBeenCalledWith({
    index: "docs",
    body: { query },
    max_docs: 10000,
    refresh: false,
  });
  await service.reindex("docs", "copy", query);
  expect(client.reindex).toHaveBeenCalledWith({
    source: { index: "docs", query },
    dest: { index: "copy" },
  });
});
it("preserves connection-test failures for public error classification", async () => {
  const error = { statusCode: 401 };
  client.info.mockRejectedValue(error);
  await expect(service.testConnection()).rejects.toBe(error);
});
it("reports bulk item failure without copying private provider reasons", async () => {
  client.bulk.mockResolvedValue({
    took: 1,
    errors: true,
    items: [
      {
        update: {
          _index: "docs",
          _id: "1",
          status: 400,
          error: {
            type: "mapper_parsing_exception",
            reason: "private-document-content",
          },
        },
      },
    ],
  });
  const result = await service.bulkOperation({
    index: "docs",
    operations: [{ action: "update", id: "1", document: {} }],
  });
  expect(result).toMatchObject({
    errors: true,
    items: [{ status: 400, error: { type: "mapper_parsing_exception" } }],
  });
  expect(JSON.stringify(result)).not.toContain("private-document-content");
});
it("summarizes delete/reindex failures without private causes", async () => {
  const outcome = {
    timed_out: false,
    failures: [
      {
        index: "docs",
        id: "1",
        status: 409,
        cause: {
          type: "version_conflict_engine_exception",
          reason: "private-document-content",
        },
      },
    ],
  };
  client.deleteByQuery.mockResolvedValue(outcome);
  client.reindex.mockResolvedValue(outcome);
  for (const result of [
    await service.deleteByQuery("docs", {}),
    await service.reindex("docs", "copy"),
  ]) {
    expect(result.failures).toEqual([
      {
        index: "docs",
        id: "1",
        status: 409,
        cause: { type: "version_conflict_engine_exception" },
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("private-document-content");
  }
});

it("maps connection, health, empty indices, count and empty node statistics", async () => {
  client.info.mockResolvedValue({
    cluster_name: "fixture",
    version: { number: "8.19.0" },
  });
  expect(await service.testConnection()).toEqual({
    connected: true,
    cluster_name: "fixture",
    version: "8.19.0",
  });
  client.cluster.health.mockResolvedValue({ status: "green" });
  expect(await service.getClusterHealth()).toEqual({ status: "green" });
  client.cat.indices.mockResolvedValue([]);
  expect(await service.listIndices()).toEqual([]);
  client.count.mockResolvedValue({ count: 0 });
  expect(await service.count("docs", {})).toEqual({ count: 0 });
  expect(client.count).toHaveBeenCalledWith({
    index: "docs",
    body: { query: {} },
  });
  client.nodes.stats.mockResolvedValue({ nodes: {} });
  expect(await service.getNodeStats()).toEqual({});
  expect(client.nodes.stats).toHaveBeenCalledWith({
    metric: ["indices", "jvm", "process", "fs"],
  });
});
it("maps index administration without invoking a cluster", async () => {
  client.indices.create.mockResolvedValue({
    acknowledged: true,
    shards_acknowledged: true,
  });
  const options = {
    index: "docs",
    mappings: { properties: {} },
    settings: { number_of_shards: 1 },
  };
  expect(await service.createIndex(options)).toMatchObject({
    acknowledged: true,
  });
  expect(client.indices.create).toHaveBeenCalledWith({
    index: "docs",
    body: { mappings: options.mappings, settings: options.settings },
  });
  client.indices.delete.mockResolvedValue({ acknowledged: true });
  expect(await service.deleteIndex("docs")).toEqual({ acknowledged: true });
  expect(client.indices.delete).toHaveBeenCalledWith({ index: "docs" });
});
it("preserves concrete index-info output and absent document semantics", async () => {
  client.indices.stats.mockResolvedValue({ indices: { docs: {} } });
  client.indices.getMapping.mockResolvedValue({ docs: { mappings: {} } });
  client.indices.getSettings.mockResolvedValue({ docs: { settings: {} } });
  expect(await service.getIndexInfo("docs")).toEqual({
    stats: {},
    mappings: {},
    settings: {},
  });
  client.get.mockRejectedValue({ statusCode: 404 });
  expect(await service.getDocument("docs", "1")).toEqual({ found: false });
  const err = { statusCode: 403 };
  client.get.mockRejectedValue(err);
  await expect(service.getDocument("docs", "1")).rejects.toBe(err);
});

it.each(["search", "aggregation", "count"])(
  "preserves partial %s data and safe shard failures through the real handler",
  async (tool) => {
    const shards = {
      total: 2,
      successful: 1,
      skipped: 0,
      failed: 1,
      failures: [
        {
          shard: 1,
          index: "docs",
          node: "node1",
          reason: {
            type: "query_shard_exception",
            reason: "private-shard-reason",
            caused_by: { reason: "private-shard-reason" },
          },
        },
      ],
    };
    const hits = {
      total: { value: 1, relation: "eq" },
      max_score: null,
      hits: [{ _index: "docs", _id: "1", _score: null }],
    };
    client.search.mockResolvedValue({
      took: 1,
      timed_out: false,
      _shards: shards,
      hits,
      aggregations: {},
    });
    client.count.mockResolvedValue({ count: 1, _shards: shards });
    const result = CallToolResultSchema.parse(
      await handleElasticsearchTool(service, `elasticsearch_${tool}`, {
        index: "docs",
        ...(tool === "aggregation" ? { aggs: {} } : {}),
      })
    );
    expect(result.isError).toBe(true);
    const content = result.content[0];
    if (content.type !== "text") throw new Error("Expected text");
    const data = JSON.parse(content.text);
    expect(data._shards).toMatchObject({
      total: 2,
      successful: 1,
      failed: 1,
      failures: [{ reason: { type: "query_shard_exception" } }],
    });
    expect(content.text).not.toContain("private-shard-reason");
    if (tool === "count") expect(data.count).toBe(1);
    else expect(data.hits.hits).toHaveLength(1);
  }
);
it.each(["search", "aggregation", "count"])(
  "keeps zero-failed-shard %s responses successful",
  async (tool) => {
    const shards = { total: 1, successful: 1, skipped: 0, failed: 0 };
    client.search.mockResolvedValue({
      took: 1,
      timed_out: false,
      _shards: shards,
      hits: { total: { value: 0, relation: "eq" }, max_score: null, hits: [] },
    });
    client.count.mockResolvedValue({ count: 0, _shards: shards });
    const result = CallToolResultSchema.parse(
      await handleElasticsearchTool(service, `elasticsearch_${tool}`, {
        index: "docs",
        ...(tool === "aggregation" ? { aggs: {} } : {}),
      })
    );
    expect(result.isError).toBe(false);
    const content = result.content[0];
    if (content.type !== "text") throw new Error("Expected text");
    expect(JSON.parse(content.text)._shards).toEqual(shards);
  }
);
