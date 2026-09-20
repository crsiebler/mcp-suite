import axios, { AxiosError } from "axios";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, expect, it, vi } from "vitest";
import { AIJobSearchService } from "../../servers/aijobsearch/src/services/aijobsearch-service.ts";
import { handleJobSearchTool } from "../../servers/aijobsearch/src/tools/handler.ts";
import { Logger } from "../../shared/utils/logger.ts";
const service = () =>
  new AIJobSearchService(
    { apiUrl: "https://fixture.invalid", apiToken: "synthetic-token" },
    new Logger("error")
  );
afterEach(() => {
  vi.restoreAllMocks();
});
it.each(["extract_skills", "match_jobs"])(
  "returns a consistent %s success envelope",
  async (name) => {
    const data =
      name === "extract_skills" ? { skills_list: [] } : { jobs_list: [] };
    vi.spyOn(axios, "post").mockResolvedValue({ data });
    const result = await handleJobSearchTool(service(), name, {
      taxonomy: "fixture",
      context: "exact <text>",
      type: "text",
    });
    expect(CallToolResultSchema.parse(result).isError).toBe(false);
    expect(result.content[0]).toEqual({
      type: "text",
      text: JSON.stringify({ success: true, data }),
    });
  }
);
it.each(["extract_skills", "match_jobs"])(
  "normalizes %s provider failures on the MCP wire",
  async (name) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(axios, "post").mockRejectedValue(
      new AxiosError(
        "private-error",
        "ERR_BAD_RESPONSE",
        undefined,
        undefined,
        {
          status: 429,
          statusText: "private-status",
          headers: { "retry-after": "20" },
          data: { message: "private-body" },
          config: { headers: {} } as never,
        }
      )
    );
    const result = await handleJobSearchTool(service(), name, {
      taxonomy: "fixture",
      context: "fixture",
      type: "text",
    });
    expect(CallToolResultSchema.parse(result).isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain("private-");
    const content = result.content[0];
    if (content.type !== "text") throw new Error("Expected text");
    expect(JSON.parse(content.text)).toMatchObject({
      success: false,
      error: { code: "rate_limited", retryAfterSeconds: 20 },
    });
  }
);
it.each([
  undefined,
  null,
  [],
  { context: "" },
  { type: "skills", skills_list: "private-invalid" },
])("rejects malformed arguments without provider access", async (args) => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const post = vi.spyOn(axios, "post").mockResolvedValue({ data: {} });
  const result = await handleJobSearchTool(service(), "match_jobs", args);
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result)).toContain("invalid_input");
  expect(JSON.stringify(result)).not.toContain("private-");
  expect(post).not.toHaveBeenCalled();
});
