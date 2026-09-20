import { errors } from "@elastic/elasticsearch";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  InputError,
  normalizeFailure,
  failure,
} from "../../../shared/utils/errors.js";
import { toMcpResult } from "../../../shared/utils/result.js";
import type { ElasticsearchService } from "./services/elasticsearch-service.js";
import { tools } from "./tools/index.js";
import { validateArguments, type ElasticArguments } from "./input.js";

export async function handleElasticsearchTool(
  service: ElasticsearchService,
  name: string,
  input: unknown
): Promise<CallToolResult> {
  try {
    const tool = tools.find((tool) => tool.name === name);
    if (!tool) throw new InputError("name");
    const args = validateArguments(tool, input ?? {});
    const data = await dispatch(service, name, args);
    if (data === undefined) return toMcpResult(failure("invalid_response"));
    // Keep existing successful JSON shapes; mark reported partial outcomes.
    const partial =
      data !== null &&
      typeof data === "object" &&
      (data.errors === true ||
        data.timed_out === true ||
        data.connected === false ||
        (typeof data._shards?.failed === "number" && data._shards.failed > 0) ||
        (Array.isArray(data.failures) && data.failures.length > 0) ||
        (typeof data.version_conflicts === "number" &&
          data.version_conflicts > 0));
    return {
      isError: partial,
      content: [{ type: "text", text: JSON.stringify(data) }],
    };
  } catch (error) {
    // Elastic ResponseError exposes status via a getter, unlike Axios metadata.
    if (error instanceof errors.ResponseError) {
      return toMcpResult(
        normalizeFailure({
          response: { status: error.statusCode, headers: error.headers },
        })
      );
    }
    if (error instanceof errors.TimeoutError)
      return toMcpResult(failure("timeout"));
    if (
      error instanceof errors.ConnectionError ||
      error instanceof errors.NoLivingConnectionsError
    )
      return toMcpResult(failure("unavailable"));
    return toMcpResult(normalizeFailure(error));
  }
}

async function dispatch(
  service: ElasticsearchService,
  name: string,
  args: ElasticArguments
): Promise<any> {
  switch (name) {
    case "elasticsearch_test_connection":
      return await service.testConnection();
    case "elasticsearch_cluster_health":
      return await service.getClusterHealth();
    case "elasticsearch_node_stats":
      return await service.getNodeStats();
    case "elasticsearch_list_indices":
      return await service.listIndices();
    case "elasticsearch_get_index_info":
      return await service.getIndexInfo(args.index);
    case "elasticsearch_create_index":
      return await service.createIndex({
        index: args.index,
        mappings: args.mappings,
        settings: args.settings,
      });
    case "elasticsearch_delete_index":
      return await service.deleteIndex(args.index);
    case "elasticsearch_index_exists":
      return { exists: await service.indexExists(args.index) };
    case "elasticsearch_search":
      return await service.search({
        index: args.index,
        query: args.query,
        size: args.size,
        from: args.from,
        sort: args.sort,
        _source: args._source,
        highlight: args.highlight,
        aggs: args.aggs,
        track_total_hits: args.track_total_hits,
      });
    case "elasticsearch_count":
      return await service.count(args.index, args.query);
    case "elasticsearch_aggregation":
      return await service.performAggregation({
        index: args.index,
        aggs: args.aggs,
        query: args.query,
        size: args.size,
      });
    case "elasticsearch_get_document":
      return await service.getDocument(args.index, args.id);
    case "elasticsearch_index_document":
      return await service.indexDocument({
        index: args.index,
        id: args.id,
        document: args.document,
        refresh: args.refresh,
      });
    case "elasticsearch_update_document":
      return await service.updateDocument(
        args.index,
        args.id,
        args.document,
        args.refresh
      );
    case "elasticsearch_delete_document":
      return await service.deleteDocument(args.index, args.id, args.refresh);
    case "elasticsearch_bulk_operation":
      return await service.bulkOperation({
        index: args.index,
        operations: args.operations,
        refresh: args.refresh,
      });
    case "elasticsearch_delete_by_query":
      return await service.deleteByQuery(args.index, args.query, args.refresh);
    case "elasticsearch_reindex":
      return await service.reindex(
        args.source_index,
        args.dest_index,
        args.query
      );
    default:
      throw new InputError("name");
  }
}
