import axios from "axios";
import { afterEach, expect, it, vi } from "vitest";
import { AIJobSearchService } from "../../servers/aijobsearch/src/services/aijobsearch-service.ts";
import { Logger } from "../../shared/utils/logger.ts";

const service = () =>
  new AIJobSearchService(
    { apiUrl: "https://fixture.invalid", apiToken: "synthetic-token" },
    new Logger("error")
  );
afterEach(() => {
  vi.restoreAllMocks();
});
it.each(["", "  ", null, 1, {}])(
  "rejects invalid required skill-extraction text %s before provider access",
  async (value) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: {} });
    await expect(
      service().extractSkills({ taxonomy: "fixture", context: value as string })
    ).rejects.toThrow("context");
    expect(post).not.toHaveBeenCalled();
  }
);
it("preserves exact text and punctuation rather than stripping markup", async () => {
  const post = vi.spyOn(axios, "post").mockResolvedValue({ data: {} });
  const context = "  TypeScript generics: Map<string, number>\n  ";
  await service().extractSkills({ taxonomy: "fixture", context });
  await service().matchJobs({ type: "text", context });
  expect(post.mock.calls[0][1]).toEqual({ taxonomy: "fixture", context });
  expect(post.mock.calls[1][1]).toEqual({ type: "text", context });
});
it("rejects invalid text-mode job context before provider access", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const post = vi.spyOn(axios, "post").mockResolvedValue({ data: {} });
  await expect(
    service().matchJobs({ type: "text", context: "  " })
  ).rejects.toThrow("context");
  expect(post).not.toHaveBeenCalled();
});
