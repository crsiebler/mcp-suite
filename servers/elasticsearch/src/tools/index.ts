import { McpTool } from "../../../../shared/types/mcp.js";

export const tools: McpTool[] = [
  // Connection and Health Tools
  {
    name: "elasticsearch_test_connection",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    description:
      "Test connection to Elasticsearch cluster and get basic cluster info",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "elasticsearch_cluster_health",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    description: "Get cluster health status and statistics",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "elasticsearch_node_stats",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    description:
      "Get simplified node statistics including CPU, memory, and disk usage",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // Index Management Tools
  {
    name: "elasticsearch_list_indices",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    description:
      "List all indices with basic information (health, status, document count, size)",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "elasticsearch_get_index_info",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    description:
      "Get detailed information about a specific index (stats, mappings, settings)",
    inputSchema: {
      type: "object",
      properties: {
        index: {
          type: "string",
          minLength: 1,
          description: "Name of the index to inspect",
        },
      },
      required: ["index"],
    },
  },
  {
    name: "elasticsearch_create_index",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    description: "Create a new index with optional mappings and settings",
    inputSchema: {
      type: "object",
      properties: {
        index: {
          type: "string",
          minLength: 1,
          description: "Name of the index to create",
        },
        mappings: {
          type: "object",
          description: "Index mappings (field definitions)",
        },
        settings: {
          type: "object",
          description: "Index settings (shards, replicas, etc.)",
        },
      },
      required: ["index"],
    },
  },
  {
    name: "elasticsearch_delete_index",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    description: "Delete an index (WARNING: This action is irreversible)",
    inputSchema: {
      type: "object",
      properties: {
        index: {
          type: "string",
          minLength: 1,
          description: "Name of the index to delete",
        },
      },
      required: ["index"],
    },
  },
  {
    name: "elasticsearch_index_exists",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    description: "Check if an index exists",
    inputSchema: {
      type: "object",
      properties: {
        index: {
          type: "string",
          minLength: 1,
          description: "Name of the index to check",
        },
      },
      required: ["index"],
    },
  },

  // Search Tools
  {
    name: "elasticsearch_search",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    description:
      "Search documents in an index with query, filters, sorting, and aggregations (max 1000 results)",
    inputSchema: {
      type: "object",
      properties: {
        index: {
          type: "string",
          minLength: 1,
          description:
            "Index name or comma-separated list of indices to search",
        },
        query: {
          type: "object",
          description: "Elasticsearch query DSL object",
        },
        size: {
          type: "integer",
          minimum: 0,
          description: "Number of results to return (max 1000, default 10)",
          maximum: 1000,
        },
        from: {
          type: "integer",
          minimum: 0,
          description:
            "Starting offset for pagination (default 0; cluster result-window limits also apply)",
          maximum: Number.MAX_SAFE_INTEGER,
        },
        sort: {
          type: "array",
          description: "Sort order for results",
          items: {
            anyOf: [{ type: "string", minLength: 1 }, { type: "object" }],
          },
        },
        _source: {
          anyOf: [
            { type: "boolean" },
            { type: "array", items: { type: "string", minLength: 1 } },
          ],
          description:
            "Fields to include in results (true/false or array of field names)",
        },
        highlight: {
          type: "object",
          description: "Highlight configuration for search results",
        },
        aggs: {
          type: "object",
          description: "Aggregations to perform",
        },
        track_total_hits: {
          type: "boolean",
          description: "Whether to track total hit count accurately",
        },
      },
      required: ["index"],
    },
  },
  {
    name: "elasticsearch_count",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    description: "Count documents matching a query",
    inputSchema: {
      type: "object",
      properties: {
        index: {
          type: "string",
          minLength: 1,
          description: "Index name to count documents in",
        },
        query: {
          type: "object",
          description: "Elasticsearch query DSL object (optional)",
        },
      },
      required: ["index"],
    },
  },
  {
    name: "elasticsearch_aggregation",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    description: "Perform aggregations on an index with optional query filter",
    inputSchema: {
      type: "object",
      properties: {
        index: {
          type: "string",
          minLength: 1,
          description: "Index name to perform aggregations on",
        },
        aggs: {
          type: "object",
          description: "Aggregation definitions",
        },
        query: {
          type: "object",
          description: "Optional query to filter documents before aggregation",
        },
        size: {
          type: "integer",
          minimum: 0,
          description:
            "Number of document hits to return (default 0 for aggregation-only)",
          maximum: 100,
        },
      },
      required: ["index", "aggs"],
    },
  },

  // Document Management Tools
  {
    name: "elasticsearch_get_document",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    description: "Get a specific document by ID",
    inputSchema: {
      type: "object",
      properties: {
        index: {
          type: "string",
          minLength: 1,
          description: "Index name containing the document",
        },
        id: {
          type: "string",
          minLength: 1,
          description: "Document ID",
        },
      },
      required: ["index", "id"],
    },
  },
  {
    name: "elasticsearch_index_document",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    description: "Index (create or update) a document",
    inputSchema: {
      type: "object",
      properties: {
        index: {
          type: "string",
          minLength: 1,
          description: "Index name to store the document",
        },
        id: {
          type: "string",
          minLength: 1,
          description: "Document ID (optional, auto-generated if not provided)",
        },
        document: {
          type: "object",
          description: "Document content",
        },
        refresh: {
          type: "boolean",
          description: "Whether to refresh the index after operation",
        },
      },
      required: ["index", "document"],
    },
  },
  {
    name: "elasticsearch_update_document",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    description: "Update an existing document",
    inputSchema: {
      type: "object",
      properties: {
        index: {
          type: "string",
          minLength: 1,
          description: "Index name containing the document",
        },
        id: {
          type: "string",
          minLength: 1,
          description: "Document ID to update",
        },
        document: {
          type: "object",
          description: "Fields to update",
        },
        refresh: {
          type: "boolean",
          description: "Whether to refresh the index after operation",
        },
      },
      required: ["index", "id", "document"],
    },
  },
  {
    name: "elasticsearch_delete_document",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    description: "Delete a document by ID",
    inputSchema: {
      type: "object",
      properties: {
        index: {
          type: "string",
          minLength: 1,
          description: "Index name containing the document",
        },
        id: {
          type: "string",
          minLength: 1,
          description: "Document ID to delete",
        },
        refresh: {
          type: "boolean",
          description: "Whether to refresh the index after operation",
        },
      },
      required: ["index", "id"],
    },
  },

  // Bulk Operations
  {
    name: "elasticsearch_bulk_operation",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    description:
      "Perform multiple document operations in a single request (max 100 operations)",
    inputSchema: {
      type: "object",
      properties: {
        index: {
          type: "string",
          minLength: 1,
          description: "Default index for operations",
        },
        operations: {
          type: "array",
          description: "Array of operations to perform",
          items: {
            type: "object",
            properties: {
              action: {
                type: "string",
                minLength: 1,
                enum: ["index", "create", "update", "delete"],
                description: "Operation type",
              },
              id: {
                type: "string",
                minLength: 1,
                description: "Document ID (optional for index/create)",
              },
              document: {
                type: "object",
                description: "Document content (not used for delete)",
              },
            },
            required: ["action"],
            allOf: [
              {
                if: { properties: { action: { enum: ["update", "delete"] } } },
                then: { required: ["id"] },
              },
              {
                if: {
                  properties: {
                    action: { enum: ["index", "create", "update"] },
                  },
                },
                then: { required: ["document"] },
              },
            ],
          },
          minItems: 1,
          maxItems: 100,
        },
        refresh: {
          type: "boolean",
          description: "Whether to refresh the index after operations",
        },
      },
      required: ["index", "operations"],
    },
  },
  {
    name: "elasticsearch_delete_by_query",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    description: "Delete documents matching a query (max 10,000 documents)",
    inputSchema: {
      type: "object",
      properties: {
        index: {
          type: "string",
          minLength: 1,
          description: "Index name to delete documents from",
        },
        query: {
          type: "object",
          description:
            "Elasticsearch query DSL to match documents for deletion",
        },
        refresh: {
          type: "boolean",
          description: "Whether to refresh the index after operation",
        },
      },
      required: ["index", "query"],
    },
  },

  // Advanced Operations
  {
    name: "elasticsearch_reindex",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    description:
      "Copy documents from one index to another with optional query filter",
    inputSchema: {
      type: "object",
      properties: {
        source_index: {
          type: "string",
          minLength: 1,
          description: "Source index name",
        },
        dest_index: {
          type: "string",
          minLength: 1,
          description: "Destination index name",
        },
        query: {
          type: "object",
          description: "Optional query to filter documents to reindex",
        },
      },
      required: ["source_index", "dest_index"],
    },
  },
];
