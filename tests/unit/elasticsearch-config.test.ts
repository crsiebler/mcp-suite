import { expect, it, vi } from "vitest";
import { ElasticsearchService } from "../../servers/elasticsearch/src/services/elasticsearch-service.ts";
const construct = vi.hoisted(() => vi.fn());
vi.mock("@elastic/elasticsearch", () => ({
  Client: class {
    constructor(options: unknown) {
      construct(options);
    }
  },
}));
it("preserves an explicitly disabled retry count", () => {
  new ElasticsearchService({ node: "http://localhost:9200", maxRetries: 0 });
  expect(construct).toHaveBeenLastCalledWith(
    expect.objectContaining({ maxRetries: 0, requestTimeout: 30000 })
  );
});
