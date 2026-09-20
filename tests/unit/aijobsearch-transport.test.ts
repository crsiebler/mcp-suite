import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { once } from "node:events";
import { afterEach, expect, it, vi } from "vitest";
import { AIJobSearchService } from "../../servers/aijobsearch/src/services/aijobsearch-service.js";
import { handleJobSearchTool } from "../../servers/aijobsearch/src/tools/handler.js";
import { Logger } from "../../shared/utils/logger.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function fixture(
  handler: (req: IncomingMessage, res: ServerResponse) => void
) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing fixture address");
  const service = new AIJobSearchService(
    { apiUrl: `http://127.0.0.1:${address.port}`, apiToken: "synthetic-token" },
    new Logger("error")
  );
  return {
    server,
    service,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    },
  };
}
const run = (service: AIJobSearchService) =>
  handleJobSearchTool(service, "extract_skills", {
    taxonomy: "fixture",
    context: "synthetic context",
  });
it("enforces response bytes in the real HTTP adapter", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const f = await fixture((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        skills_list: [],
        extra: "PRIVATE_RESPONSE" + "x".repeat(1048576),
      })
    );
  });
  try {
    const result = await run(f.service);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('"invalid_response"');
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  } finally {
    await f.close();
  }
});
it("does not forward a job-search POST through redirects", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  let requests = 0;
  const f = await fixture((_req, res) => {
    requests++;
    res.writeHead(307, { Location: "/unexpected" });
    res.end();
  });
  try {
    expect((await run(f.service)).isError).toBe(true);
    expect(requests).toBe(1);
  } finally {
    await f.close();
  }
});
it("cancels a hanging real HTTP request at its deadline", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const f = await fixture(() => undefined);
  try {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const requestArrived = once(f.server, "request");
    const pending = run(f.service);
    await requestArrived;
    await vi.advanceTimersByTimeAsync(30000);
    const result = await pending;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('"timeout"');
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
    await f.close();
  }
});
