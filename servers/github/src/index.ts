#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

import { Logger } from "../../../shared/utils/logger.js";
import { getEnvVar, getLogLevel } from "../../../shared/utils/config.js";
import { GitHubService } from "./services/github-service.js";
import { githubTools } from "./tools/index.js";
import { GitHubConfig } from "./types.js";

class GitHubServer {
  private server: Server;
  private githubService: GitHubService;
  private logger: Logger;

  constructor() {
    this.logger = new Logger(getLogLevel(), { server: "github" });

    const config: GitHubConfig = {
      token: getEnvVar("GITHUB_TOKEN"),
      baseUrl: process.env.GITHUB_BASE_URL,
    };

    this.githubService = new GitHubService(config, this.logger);

    this.server = new Server(
      {
        name: "github-server",
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
      tools: githubTools,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const result = await this.handleToolCall(
          request.params.name,
          request.params.arguments
        );
        return this.formatResponse(result);
      } catch (error) {
        this.logger.error("Tool call failed", error);
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error}`
        );
      }
    });
  }

  private async handleToolCall(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case "list_user_repositories":
        return await this.githubService.listUserRepositories(args);
      case "get_repository":
        return await this.githubService.getRepository(args);
      case "list_repository_contents":
        return await this.githubService.listRepositoryContents(args);
      case "get_file_content":
        return await this.githubService.getFileContent(args);
      case "search_repositories":
        return await this.githubService.searchRepositories(args);
      case "get_repository_readme":
        return await this.githubService.getRepositoryReadme(args);
      case "list_branches":
        return await this.githubService.listBranches(args);
      case "list_languages":
        return await this.githubService.listLanguages(args);
      case "list_contributors":
        return await this.githubService.listContributors(args);
      case "get_repository_stats":
        // This is actually just get_repository but focused on stats
        return await this.githubService.getRepository(args);
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${toolName}`
        );
    }
  }

  private formatResponse(result: any) {
    if (result && typeof result === 'object' && 'success' in result) {
      // Handle ServerResponse format
      if (result.success) {
        const text = result.data
          ? JSON.stringify(result.data, null, 2)
          : "Operation completed successfully";
        return {
          content: [
            {
              type: "text" as const,
              text: text,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text" as const,
              text: result.error || result.message || "Operation failed",
            },
          ],
          isError: true,
        };
      }
    } else {
      // Handle direct data returns
      const text = result
        ? JSON.stringify(result, null, 2)
        : "Operation completed successfully";

      return {
        content: [
          {
            type: "text" as const,
            text: text,
          },
        ],
      };
    }
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      this.logger.error("MCP Server error", error);
    };

    process.on("SIGINT", async () => {
      this.logger.info("Shutting down GitHub MCP server");
      await this.server.close();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      this.logger.info("Shutting down GitHub MCP server");
      await this.server.close();
      process.exit(0);
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info("GitHub MCP server running on stdio");
  }
}

const server = new GitHubServer();
server.run().catch((error) => {
  console.error("Failed to start GitHub MCP server:", error);
  process.exit(1);
});