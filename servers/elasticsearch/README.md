# Elasticsearch MCP Server

A comprehensive Model Context Protocol (MCP) server for Elasticsearch operations, providing search, analytics, and document management capabilities with built-in data limiting controls.

## Installation & Usage

### Option 1: npm Package (Recommended)

```bash
# Install globally
npm install -g @crsiebler/mcp-elasticsearch-server

# Or run directly with npx
npx @crsiebler/mcp-elasticsearch-server
```

### Option 2: Build from Source

```bash
# From project root
npm ci
npm run build -- --server=elasticsearch

# The server will be available at:
./servers/elasticsearch/dist/servers/elasticsearch/src/index.js
```

## Cline MCP Configuration

To use this server with Cline (VS Code extension), add the following to your Cline MCP settings:

**File Location:**

- **macOS**: `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- **Windows**: `%APPDATA%/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- **Linux**: `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

**Configuration:**

```json
{
  "mcpServers": {
    "elasticsearch-integration": {
      "command": "npx",
      "args": ["@crsiebler/mcp-elasticsearch-server"],
      "env": {
        "ELASTICSEARCH_NODE": "http://localhost:9200",
        "ELASTICSEARCH_USERNAME": "elastic",
        "ELASTICSEARCH_PASSWORD": "your-password"
      },
      "disabled": false,
      "alwaysAllow": []
    }
  }
}
```

## Features

### 🔍 **Search & Analytics**

- Full-text search with query DSL support
- Aggregations and analytics with result limiting
- Document counting and statistics
- Pagination support (max 1000 results per search)

### 📊 **Index Management**

- List all indices with health information
- Create and delete indices
- Get detailed index information (stats, mappings, settings)
- Index existence checks

### 📄 **Document Operations**

- CRUD operations for individual documents
- Bulk operations (limited to 100 operations per request)
- Delete by query (limited to 10,000 documents)
- Reindexing with optional query filters

### 🏥 **Cluster Health & Monitoring**

- Connection testing and cluster information
- Cluster health status and statistics
- Node statistics (CPU, memory, disk usage)

### 🛡️ **Built-in Safety Controls**

- Search results limited to 1000 documents maximum
- Bulk operations limited to 100 operations per request
- Delete by query limited to 10,000 documents maximum
- Aggregation document hits limited to 100; bucket counts and response bytes depend on cluster limits
- Connection timeout and retry controls

## Quick Setup

### Environment Variables

**Required:**

- `ELASTICSEARCH_NODE` - Elasticsearch node URL (default: `http://localhost:9200`)

**Authentication (choose one):**

- `ELASTICSEARCH_USERNAME` and `ELASTICSEARCH_PASSWORD` - Basic authentication
- `ELASTICSEARCH_API_KEY` - API key authentication

**Optional:**

- `ELASTICSEARCH_MAX_RETRIES` - Maximum retry attempts, integer 0–10 (default: 3; 0 disables retries)
- `ELASTICSEARCH_REQUEST_TIMEOUT` - Request timeout, integer 1–300000 milliseconds (default: 30000)

### Example Configuration

```bash
# Basic setup with local Elasticsearch
export ELASTICSEARCH_NODE="http://localhost:9200"

# With basic authentication
export ELASTICSEARCH_NODE="https://elasticsearch.example.com:9200"
export ELASTICSEARCH_USERNAME="elastic"
export ELASTICSEARCH_PASSWORD="your-password"

# With API key authentication
export ELASTICSEARCH_NODE="https://elasticsearch.example.com:9200"
export ELASTICSEARCH_API_KEY="your-api-key"

# With custom timeout and retries
export ELASTICSEARCH_MAX_RETRIES="5"
export ELASTICSEARCH_REQUEST_TIMEOUT="60000"
```

## Available Tools (18)

### Connection & Health Tools (3)

```
elasticsearch_test_connection    - Test connection and get cluster info
elasticsearch_cluster_health     - Get cluster health status and statistics
elasticsearch_node_stats         - Get simplified node statistics
```

### Index Management Tools (5)

```
elasticsearch_list_indices       - List all indices with basic information
elasticsearch_get_index_info     - Get detailed index information
elasticsearch_create_index       - Create a new index with mappings/settings
elasticsearch_delete_index       - Delete an index (irreversible)
elasticsearch_index_exists       - Check if an index exists
```

### Search Tools (3)

```
elasticsearch_search             - Search documents with query DSL (max 1000 results)
elasticsearch_count              - Count documents matching a query
elasticsearch_aggregation        - Perform aggregations with optional query filter
```

### Document Management Tools (4)

```
elasticsearch_get_document       - Get a specific document by ID
elasticsearch_index_document     - Index (create/update) a document
elasticsearch_update_document    - Update an existing document
elasticsearch_delete_document    - Delete a document by ID
```

### Bulk & Advanced Operations (3)

```
elasticsearch_bulk_operation     - Multiple document operations (max 100 ops)
elasticsearch_delete_by_query    - Delete documents by query (max 10,000 docs)
elasticsearch_reindex            - Copy documents between indices
```

## Usage Examples

### Search Documents

```json
{
  "name": "elasticsearch_search",
  "arguments": {
    "index": "my-index",
    "query": {
      "match": {
        "title": "elasticsearch"
      }
    },
    "size": 10,
    "sort": [{ "timestamp": { "order": "desc" } }]
  }
}
```

### Create Index with Mapping

```json
{
  "name": "elasticsearch_create_index",
  "arguments": {
    "index": "products",
    "mappings": {
      "properties": {
        "name": { "type": "text" },
        "price": { "type": "float" },
        "created_at": { "type": "date" }
      }
    },
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0
    }
  }
}
```

### Perform Aggregations

```json
{
  "name": "elasticsearch_aggregation",
  "arguments": {
    "index": "sales",
    "aggs": {
      "sales_per_month": {
        "date_histogram": {
          "field": "date",
          "calendar_interval": "month"
        }
      }
    }
  }
}
```

### Bulk Operations

```json
{
  "name": "elasticsearch_bulk_operation",
  "arguments": {
    "index": "logs",
    "operations": [
      {
        "action": "index",
        "id": "1",
        "document": { "message": "Log entry 1", "level": "info" }
      },
      {
        "action": "update",
        "id": "2",
        "document": { "level": "error" }
      }
    ],
    "refresh": true
  }
}
```

## Security Best Practices

1. **Use HTTPS** for production Elasticsearch clusters
2. **Enable authentication** with username/password or API keys
3. **Limit network access** to Elasticsearch from trusted sources only
4. **Monitor queries** to prevent expensive operations
5. **Set up proper indices** with appropriate mappings and settings
6. **Use aliases** instead of direct index names for flexibility

## Data Limiting Controls

This server includes several built-in controls to prevent overwhelming your Elasticsearch cluster:

- **Search Results**: Limited to 1000 documents per search request
- **Bulk Operations**: Limited to 100 operations per request
- **Delete by Query**: Limited to 10,000 documents per operation
- **Aggregation Size**: Default to 0 document hits for aggregation-only queries
- **Connection Timeouts**: 30-second default timeout with configurable retries
- **Node Stats**: Simplified to essential metrics only

## Development

### Build and Run

```bash
# From the repository root
npm ci
npm run build -- --server=elasticsearch
npm start --workspace=@crsiebler/mcp-elasticsearch-server
npm test -- tests/unit/elasticsearch-service.test.ts tests/unit/elasticsearch-handler.test.ts
npm run type-check
```

### Dependencies

- `@elastic/elasticsearch` - Official Elasticsearch client
- `@modelcontextprotocol/sdk` - MCP SDK for server implementation

## Troubleshooting

### Connection Issues

- Verify `ELASTICSEARCH_NODE` URL is correct
- Check if Elasticsearch is running and accessible
- Ensure authentication credentials are valid
- Check network connectivity and firewall settings

### Performance Issues

- Use pagination (`from` and `size`) for large result sets
- Implement query filters to reduce result sets
- Use aggregations instead of large searches when possible
- Monitor cluster health and node statistics

### Authentication Issues

- Verify username/password or API key are correct
- Ensure the user has appropriate permissions
- Check if the authentication method is enabled in Elasticsearch

## License

Existing metadata declares MIT; see [license provenance](../../docs/licensing.md).

Configuration is validated before startup; see [configuration rules](../../docs/server-development.md#configuration-and-input-validation) for endpoint restrictions and blank/invalid-setting behavior.

## Verified tool contracts and migration

The 18 names above are unchanged. `src/handler.ts` owns dispatch and MCP results;
`src/input.ts` validates tool arguments before provider access. The provider
service retains Elasticsearch-specific index and document operations. Authentication
selection is unchanged.

- Success content retains the existing raw JSON data shape. Execution failures
  now return MCP `isError: true` with `{ "success": false, "error": { "code": "...",
"message": "..." } }` instead of throwing raw provider errors. Retry metadata
  is advisory. Connection-test errors and failed index-existence requests now
  return errors rather than implying disconnected/absent data.
- Search, aggregation and count preserve safe `_shards` counts and machine failure
  types. Failed shards set `isError: true` while retaining available hits/counts;
  a successful HTTP response can still be incomplete. Nested failure reasons
  are omitted.
- Bulk `errors: true`, query/reindex failure lists, version conflicts and reported
  timeouts set `isError: true` while retaining the partial result data. Error
  reasons/nested causes are omitted; machine error types and per-operation status
  remain. Inspect partial results before retrying: mutations are not rolled back
  as a group. The underlying client's configured retry behavior is unchanged.
- `size` is a nonnegative integer: search accepts 0–1000 (default 10), aggregation
  accepts 0–100 (default 0). Oversized inputs are rejected, not silently clamped.
  Zero search size remains zero. Aggregation responses now include requested hits.
  `from` is a nonnegative safe integer; Elasticsearch still enforces its configured
  result window. This interface does not expose `search_after` or scroll pagination.
- Untracked search totals are `null`, not fabricated zero totals. Null relevance
  scores remain null; `gte` total relations remain lower bounds. Empty hits,
  indices, buckets and node maps remain valid empty data.
- Bulk input requires 1–100 actions. Update/delete require `id`; index/create/update
  require object `document`. Update documents are sent as `{ "doc": document }`.
  Single-document refresh flags preserve explicit `false`.
- Concrete index information retains `{ stats, mappings, settings }`. An alias or
  pattern resolving to other names returns `{ indices: { "resolved-name": { stats,
mappings, settings } } }` so resolved data is not lost.
- All tools advertise read/write annotations. Creation, indexing, updates, deletion,
  bulk operations and reindexing are writes; creation is non-destructive, the other
  writes may overwrite/delete data. Hints are not authorization controls. Hosts
  must apply their own write approval policy, and Elasticsearch credentials determine
  actual privileges. Older clients may ignore these annotations.

Hit/action limits do not bound document byte size, aggregation buckets, index/node
inventory size, or reindex volume. Delete-by-query sends `max_docs: 10000`; partial
failures and concurrent changes remain provider semantics. Query DSL and mappings
are object-validated here and semantically validated by Elasticsearch.

Official contracts: [bulk request and partial failures](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-bulk),
[search totals and pagination](https://www.elastic.co/guide/en/elasticsearch/reference/8.19/search-your-data.html).
Fixtures use the real service with a fake client, and packaged tests use SDK 0.5
stdio with network access blocked. They establish local mappings, input boundaries,
error formatting and startup; they do not validate live cluster permissions or
create/delete any cluster resources.
