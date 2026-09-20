import {
  ErrorCode,
  McpError,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { AIJobSearchService } from "../services/aijobsearch-service.js";
import { normalizeFailure } from "../../../../shared/utils/errors.js";
import { toMcpResult } from "../../../../shared/utils/result.js";

export async function handleJobSearchTool(
  service: AIJobSearchService,
  name: string,
  args: unknown
): Promise<CallToolResult> {
  // Unknown tools are protocol errors; provider/input failures are tool results.
  if (name !== "extract_skills" && name !== "match_jobs") {
    throw new McpError(ErrorCode.MethodNotFound, "Unknown tool");
  }
  try {
    const data =
      name === "extract_skills"
        ? await service.extractSkills(args)
        : await service.matchJobs(args);
    return toMcpResult({ success: true, data });
  } catch (error: unknown) {
    return toMcpResult(normalizeFailure(error));
  }
}
