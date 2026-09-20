#!/usr/bin/env node
import {
  ConfigurationError,
  getHttpUrlEnvVar,
  getEnvVar,
} from "../../../shared/utils/config.js";
import { Logger } from "../../../shared/utils/logger.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance } from "axios";

import { CanvasToolRegistry, createCanvasGroups } from "./registry.js";

const CANVAS_BASE_URL = getHttpUrlEnvVar("CANVAS_BASE_URL");
const CANVAS_API_TOKEN = getEnvVar("CANVAS_API_TOKEN");

class CanvasServer {
  private server: Server;
  private canvasClient: AxiosInstance;
  private registry: CanvasToolRegistry;

  constructor() {
    this.server = new Server(
      {
        name: "canvas-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Create Canvas API client with bearer token auth
    this.canvasClient = axios.create({
      baseURL: `${CANVAS_BASE_URL}/api/v1`,
      headers: {
        Authorization: `Bearer ${CANVAS_API_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    this.registry = new CanvasToolRegistry(
      createCanvasGroups(this.canvasClient),
      process.env.CANVAS_TOOL_CATEGORIES
    );

    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) =>
      new Logger("error", { server: "canvas" }).error(
        "MCP transport error",
        error
      );
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.registry.getToolDefinitions(),
    }));
    this.server.setRequestHandler(CallToolRequestSchema, async (request) =>
      this.registry.callTool(request.params.name, request.params.arguments)
    );
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    new Logger("info", { server: "canvas" }).info(
      "Canvas MCP server running on stdio"
    );
  }
}

async function main() {
  const server = new CanvasServer();
  await server.run();
}
main().catch((error) => {
  new Logger("error", { server: "canvas" }).error(
    error instanceof ConfigurationError
      ? error.message
      : "Server startup failed",
    error
  );
  process.exitCode = 1;
});
