import type {
  Tool,
  Resource,
  Prompt,
} from "@modelcontextprotocol/sdk/types.js";

// Reuse the installed SDK's contracts rather than permissive local copies.
export type McpTool = Tool;
export type McpResource = Resource;
export type McpPrompt = Prompt;

export interface McpServer {
  name: string;
  version: string;
  tools?: McpTool[];
  resources?: McpResource[];
  prompts?: McpPrompt[];
}
