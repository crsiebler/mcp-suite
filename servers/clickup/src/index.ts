#!/usr/bin/env node
import { getEnvVar } from "../../../shared/utils/config.js";
import { Logger } from "../../../shared/utils/logger.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance } from "axios";

import { tools } from "./tools.js";
import { ClickUpHandler } from "./handler.js";

const CLICKUP_API_TOKEN = getEnvVar("CLICKUP_API_TOKEN");

class ClickUpServer {
  private server: Server;
  private api: AxiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: "clickup-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.api = axios.create({
      baseURL: "https://api.clickup.com/api/v2",
      headers: {
        Authorization: CLICKUP_API_TOKEN,
        "Content-Type": "application/json",
      },
    });

    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error: any) =>
      new Logger("error", { server: "clickup" }).error(
        "MCP transport error",
        error
      );
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    const handler = new ClickUpHandler(this.api);
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools,
    }));
    this.server.setRequestHandler(CallToolRequestSchema, async (request) =>
      handler.callTool(request.params.name, request.params.arguments)
    );
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    new Logger("info", { server: "clickup" }).info(
      "ClickUp MCP server running on stdio"
    );
  }
}

const server = new ClickUpServer();
server
  .run()
  .catch((error) =>
    new Logger("error", { server: "clickup" }).error(
      "Server startup failed",
      error
    )
  );
