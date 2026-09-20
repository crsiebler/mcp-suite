#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "../../../shared/utils/logger.js";
import { readConfig } from "./config.js";
import { JevService } from "./service.js";
import { jevTools } from "./tools.js";
import { errorResult, JevError } from "./errors.js";

async function main() {
  let config: ReturnType<typeof readConfig>;
  try {
    config = readConfig();
  } catch (error) {
    // Shared configuration errors contain a fixed message and setting name only.
    new Logger().error(
      error instanceof Error ? error.message : "Invalid Jev configuration"
    );
    process.exitCode = 1;
    return;
  }
  const logger = new Logger(config.logLevel);
  const service = new JevService(config);
  const server = new Server(
    { name: "mcp-jev", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: jevTools,
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    try {
      if (request.params.name !== "jev_evaluate")
        throw new JevError("INVALID_INPUT");
      const result = await service.evaluate(
        request.params.arguments,
        extra.signal
      );
      return {
        structuredContent: result,
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    } catch (error) {
      return errorResult(error);
    }
  });
  server.onerror = () => logger.error("MCP protocol error");
  server.onclose = () => service.shutdown();
  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    service.shutdown();
    void server.close().catch(() => {
      process.exitCode = 1;
    });
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
  process.stdin.once("end", close);
  await server.connect(new StdioServerTransport());
  logger.info("Jev MCP server ready");
}
main().catch(() => {
  new Logger().error("Jev startup failed");
  process.exitCode = 1;
});
