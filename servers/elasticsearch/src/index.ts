#!/usr/bin/env node
import {
  ConfigurationError,
  getHttpUrlEnvVar,
  getIntegerEnvVar,
} from "../../../shared/utils/config.js";
import { Logger } from "../../../shared/utils/logger.js";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ElasticsearchService } from "./services/elasticsearch-service.js";
import { handleElasticsearchTool } from "./handler.js";
import { tools } from "./tools/index.js";
import { ElasticsearchConfig } from "./types/index.js";

class ElasticsearchServer {
  private server: Server;
  private elasticsearchService: ElasticsearchService | undefined;

  constructor() {
    this.server = new Server(
      {
        name: "elasticsearch-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) =>
      new Logger("error", { server: "elasticsearch" }).error(
        "MCP transport error",
        error
      );
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (!this.elasticsearchService) {
        throw new Error(
          "Elasticsearch service not initialized. Please check your Elasticsearch configuration."
        );
      }

      return handleElasticsearchTool(
        this.elasticsearchService,
        name,
        args ?? {}
      );
    });
  }

  async run(): Promise<void> {
    // Get Elasticsearch configuration from environment variables
    const elasticsearchNode = getHttpUrlEnvVar(
      "ELASTICSEARCH_NODE",
      "http://localhost:9200"
    );

    const config: ElasticsearchConfig = {
      node: elasticsearchNode,
    };

    // Add authentication if provided
    if (
      process.env.ELASTICSEARCH_USERNAME &&
      process.env.ELASTICSEARCH_PASSWORD
    ) {
      config.auth = {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD,
      };
    } else if (process.env.ELASTICSEARCH_API_KEY) {
      config.auth = {
        apiKey: process.env.ELASTICSEARCH_API_KEY,
      };
    }

    config.maxRetries = getIntegerEnvVar("ELASTICSEARCH_MAX_RETRIES", {
      min: 0,
      max: 10,
      defaultValue: 3,
    });
    config.requestTimeout = getIntegerEnvVar("ELASTICSEARCH_REQUEST_TIMEOUT", {
      min: 1,
      max: 300000,
      defaultValue: 30000,
    });

    this.elasticsearchService = new ElasticsearchService(config);

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    new Logger("info", { server: "elasticsearch" }).info(
      "Elasticsearch MCP server running on stdio"
    );
  }
}

const server = new ElasticsearchServer();
server.run().catch((error) => {
  new Logger("error", { server: "elasticsearch" }).error(
    error instanceof ConfigurationError
      ? error.message
      : "Server startup failed",
    error
  );
  process.exitCode = 1;
});
