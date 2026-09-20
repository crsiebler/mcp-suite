import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIJobSearchService } from "../../servers/aijobsearch/src/services/aijobsearch-service.js";
import { handleJobSearchTool } from "../../servers/aijobsearch/src/tools/handler.js";
import { Logger } from "../../shared/utils/logger.js";

const skill = {
  title: "Engineering",
  description: "Synthetic description",
  taxonomy_reference_link: "https://fixture.invalid/skill",
  match_relevance: 0.8,
};
const job = {
  title: "Engineer",
  description: "Synthetic role",
  job_site: "Fixture",
  link_to_job: "https://fixture.invalid/job",
  skills_matched: [skill],
  jobs_match_relevance: 0.75,
};
const variants: [string, Record<string, unknown>, string, unknown, unknown][] =
  [
    [
      "extract_skills",
      { taxonomy: "fixture", context: "  literal <text>\n" },
      "/skills",
      { taxonomy: "fixture", context: "  literal <text>\n" },
      { skills_list: [skill] },
    ],
    [
      "match_jobs",
      { type: "text", context: "  literal <text>\n" },
      "/jobs",
      { type: "text", context: "  literal <text>\n" },
      { jobs_list: [job] },
    ],
    [
      "match_jobs",
      {
        type: "skills",
        skills_list: [
          {
            title: "T",
            description: "D",
            taxonomy: "fixture",
            extra: "omitted",
          },
        ],
      },
      "/jobs",
      {
        type: "skills",
        context: {
          skills_list: [{ title: "T", description: "D", taxonomy: "fixture" }],
        },
      },
      { jobs_list: [job] },
    ],
  ];
const service = () =>
  new AIJobSearchService(
    { apiUrl: "https://fixture.invalid/base/", apiToken: "PRIVATE_TOKEN" },
    new Logger("debug")
  );
const text = (result: Awaited<ReturnType<typeof handleJobSearchTool>>) =>
  result.content[0].text as string;
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ASU provisional repository contract", () => {
  it.each(variants)(
    "maps %s request and enforces transport limits",
    async (name, args, path, body, data) => {
      const post = vi.spyOn(axios, "post").mockResolvedValue({ data });
      const result = await handleJobSearchTool(service(), name, args);
      expect(result.isError).toBe(false);
      expect(JSON.parse(text(result))).toEqual({ success: true, data });
      expect(post).toHaveBeenCalledTimes(1);
      expect(post.mock.calls[0][0]).toBe("https://fixture.invalid/base" + path);
      expect(post.mock.calls[0][1]).toEqual(body);
      expect(post.mock.calls[0][2]).toMatchObject({
        timeout: 30000,
        maxContentLength: 1048576,
        maxBodyLength: 262144,
        maxRedirects: 0,
        headers: {
          Authorization: "Bearer PRIVATE_TOKEN",
          "Content-Type": "application/json",
        },
      });
      expect(post.mock.calls[0][2]?.signal).toBeInstanceOf(AbortSignal);
    }
  );
  it.each([
    ["extract_skills", undefined],
    ["extract_skills", null],
    ["extract_skills", "PRIVATE_HTML"],
    ["extract_skills", {}],
    ["extract_skills", { skills_list: {} }],
    ["extract_skills", { skills_list: [{}] }],
    ["extract_skills", { skills_list: [{ ...skill, match_relevance: "0.8" }] }],
    [
      "extract_skills",
      { skills_list: [{ ...skill, match_relevance: Infinity }] },
    ],
    ["match_jobs", undefined],
    ["match_jobs", null],
    ["match_jobs", "PRIVATE_HTML"],
    ["match_jobs", []],
    ["match_jobs", { error: "PRIVATE_ERROR" }],
    ["match_jobs", { jobs_list: [{}] }],
    ["match_jobs", { jobs_list: [{ ...job, skills_matched: [null] }] }],
    ["match_jobs", { jobs_list: [{ ...job, jobs_match_relevance: NaN }] }],
  ] as [string, unknown][])(
    "rejects malformed %s response (%j)",
    async (name, data) => {
      vi.spyOn(axios, "post").mockResolvedValue({ data });
      const result = await handleJobSearchTool(service(), name, {
        taxonomy: "fixture",
        context: "PRIVATE_RESUME",
        type: "text",
      });
      expect(result.isError).toBe(true);
      expect(JSON.parse(text(result)).error.code).toBe("invalid_response");
      expect(text(result)).not.toContain("PRIVATE");
      expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
        "PRIVATE"
      );
    }
  );
  it.each(["extract_skills", "match_jobs"])(
    "preserves empty %s result inventories",
    async (name) => {
      const data =
        name === "extract_skills" ? { skills_list: [] } : { jobs_list: [] };
      vi.spyOn(axios, "post").mockResolvedValue({ data });
      expect(
        JSON.parse(
          text(
            await handleJobSearchTool(service(), name, {
              taxonomy: "fixture",
              context: "fixture",
              type: "text",
            })
          )
        )
      ).toEqual({ success: true, data });
    }
  );
  it.each([
    ["extract_skills", { taxonomy: "x".repeat(257), context: "fixture" }],
    ["extract_skills", { taxonomy: "fixture", context: "x".repeat(65537) }],
    ["match_jobs", { type: "text", context: "😀".repeat(20000) }],
    ["match_jobs", { type: "skills", skills_list: [] }],
    [
      "match_jobs",
      {
        type: "skills",
        skills_list: Array.from({ length: 101 }, () => ({
          title: "T",
          description: "D",
          taxonomy: "fixture",
        })),
      },
    ],
    [
      "match_jobs",
      {
        type: "skills",
        skills_list: [
          { title: "T".repeat(1025), description: "D", taxonomy: "fixture" },
        ],
      },
    ],
    [
      "match_jobs",
      {
        type: "skills",
        skills_list: Array.from({ length: 100 }, () => ({
          title: "T",
          description: "x".repeat(4096),
          taxonomy: "fixture",
        })),
      },
    ],
    [
      "extract_skills",
      { taxonomy: "fixture", context: "\u0000".repeat(65536) },
    ],
  ] as [string, unknown][])(
    "rejects oversized/empty %s input without I/O",
    async (name, args) => {
      const post = vi.spyOn(axios, "post").mockResolvedValue({ data: {} });
      const result = await handleJobSearchTool(service(), name, args);
      expect(result.isError).toBe(true);
      expect(JSON.parse(text(result)).error.code).toBe("invalid_input");
      expect(post).not.toHaveBeenCalled();
    }
  );
  it("accepts an exact UTF-8 text limit and enforces aggregate response bytes", async () => {
    const post = vi
      .spyOn(axios, "post")
      .mockResolvedValueOnce({ data: { skills_list: [] } })
      .mockResolvedValueOnce({
        data: { skills_list: [], extra: "PRIVATE" + "x".repeat(1048576) },
      });
    const s = service();
    expect(
      (
        await handleJobSearchTool(s, "extract_skills", {
          taxonomy: "fixture",
          context: "x".repeat(65536),
        })
      ).isError
    ).toBe(false);
    const result = await handleJobSearchTool(s, "extract_skills", {
      taxonomy: "fixture",
      context: "fixture",
    });
    expect(JSON.parse(text(result)).error.code).toBe("invalid_response");
    expect(text(result)).not.toContain("PRIVATE");
    expect(post).toHaveBeenCalledTimes(2);
  });
  it("aborts at the total deadline and releases its timer without retry", async () => {
    vi.useFakeTimers();
    let cancelled = false;
    const post = vi.spyOn(axios, "post").mockImplementation(
      (_url, _body, options?: AxiosRequestConfig) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener?.("abort", () => {
            cancelled = true;
            reject(new AxiosError("PRIVATE", "ERR_CANCELED"));
          });
        })
    );
    const pending = handleJobSearchTool(service(), "extract_skills", {
      taxonomy: "fixture",
      context: "PRIVATE_RESUME",
    });
    await vi.advanceTimersByTimeAsync(29999);
    expect(cancelled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(cancelled).toBe(true);
    const result = await pending;
    expect(JSON.parse(text(result)).error.code).toBe("timeout");
    expect(text(result)).not.toContain("PRIVATE");
    expect(post).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([true, false])(
    "clears deadline after immediate success=%s",
    async (success) => {
      vi.useFakeTimers();
      const post = vi.spyOn(axios, "post");
      if (success) post.mockResolvedValue({ data: { jobs_list: [] } });
      else post.mockRejectedValue(new AxiosError("PRIVATE", "ETIMEDOUT"));
      const result = await handleJobSearchTool(service(), "match_jobs", {
        type: "text",
        context: "PRIVATE_RESUME",
      });
      expect(result.isError).toBe(!success);
      expect(vi.getTimerCount()).toBe(0);
      expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
        "PRIVATE"
      );
    }
  );
});
