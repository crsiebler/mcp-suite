import axios, { AxiosError } from "axios";
import { afterEach, expect, it, vi } from "vitest";
import { AIJobSearchService } from "../../servers/aijobsearch/src/services/aijobsearch-service.ts";
import { Logger } from "../../shared/utils/logger.ts";

afterEach(() => {
  vi.restoreAllMocks();
});
it("preserves structured provider metadata instead of copying private error text", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const providerError = new AxiosError(
    "private-provider-message",
    "ERR_BAD_RESPONSE",
    undefined,
    undefined,
    {
      status: 429,
      statusText: "private-status",
      headers: { "retry-after": "30" },
      data: { message: "private-body" },
      config: { headers: {} } as never,
    }
  );
  vi.spyOn(axios, "post").mockRejectedValue(providerError);
  const service = new AIJobSearchService(
    { apiUrl: "https://fixture.invalid", apiToken: "fixture-token" },
    new Logger("error")
  );
  await expect(
    service.extractSkills({ taxonomy: "fixture", context: "fixture" })
  ).rejects.toBe(providerError);
});
