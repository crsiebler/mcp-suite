#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { Logger } from "../../../shared/utils/logger.js";
import {
  getEnvVar,
  getLogLevel,
  getHttpUrlEnvVar,
} from "../../../shared/utils/config.js";
import { AIJobSearchService } from "./services/aijobsearch-service.js";
import { handleJobSearchTool } from "./tools/handler.js";
import { aijobsearchTools } from "./tools/index.js";
import { AIJobSearchConfig } from "./types/index.js";

class AIJobSearchServer {
  private server: Server;
  private aijobsearchService: AIJobSearchService;
  private logger: Logger;

  constructor() {
    this.logger = new Logger(getLogLevel(), { server: "aijobsearch" });

    const config: AIJobSearchConfig = {
      apiUrl: getHttpUrlEnvVar(
        "AIJOBSEARCH_API_URL",
        "https://api-main-poc.aiml.asu.edu"
      ),
      apiToken: getEnvVar("AIJOBSEARCH_API_TOKEN"),
    };

    this.aijobsearchService = new AIJobSearchService(config, this.logger);

    this.server = new Server(
      {
        name: "aijobsearch-server",
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

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: aijobsearchTools,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) =>
      handleJobSearchTool(
        this.aijobsearchService,
        request.params.name,
        request.params.arguments
      )
    );
  }

  private setupErrorHandling(): void {
    process.on("SIGINT", async () => {
      this.logger.info("Received SIGINT, shutting down gracefully");
      await this.cleanup();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      this.logger.info("Received SIGTERM, shutting down gracefully");
      await this.cleanup();
      process.exit(0);
    });

    process.on("uncaughtException", (error: Error) => {
      this.logger.error("Uncaught exception", error);
      process.exit(1);
    });

    process.on("unhandledRejection", (reason: unknown) => {
      this.logger.error("Unhandled rejection", reason);
      process.exit(1);
    });
  }

  private async cleanup(): Promise<void> {
    this.logger.info("Cleanup completed");
  }

  async start(): Promise<void> {
    this.logger.info("Starting AI Job Search MCP Server");
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info("AI Job Search MCP Server started successfully");
  }
}

const server = new AIJobSearchServer();
server.start().catch((error) => {
  new Logger("error", { server: "aijobsearch" }).error(
    "Server startup failed",
    error
  );
  process.exit(1);
});
