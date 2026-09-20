import axios, { type InternalAxiosRequestConfig } from "axios";
import { expect, it } from "vitest";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  CanvasToolRegistry,
  createCanvasGroups,
} from "../../servers/canvas/src/registry.ts";

function fixture(link?: string, data: unknown = [{ id: 1 }]) {
  const requests: InternalAxiosRequestConfig[] = [];
  const client = axios.create({
    baseURL: "https://canvas.fixture.invalid/api/v1",
    adapter: async (config) => {
      requests.push(config);
      return {
        status: 200,
        statusText: "OK",
        headers: link ? { LiNk: link } : {},
        config,
        data,
      };
    },
  });
  const registry = new CanvasToolRegistry(
    createCanvasGroups(client),
    "courses"
  );
  async function call(args: Record<string, unknown>) {
    const result = CallToolResultSchema.parse(
      await registry.callTool("list_courses", args)
    );
    const content = result.content[0];
    if (content.type !== "text") throw new Error("Expected text");
    return { ...result, data: JSON.parse(content.text) };
  }
  return { requests, call };
}
it("keeps legacy arrays and performs only one request", async () => {
  const { call, requests } = fixture(
    '<https://canvas.fixture.invalid/api/v1/courses?opaque=next>; rel="next"'
  );
  expect((await call({})).data).toEqual([{ id: 1 }]);
  expect(requests).toHaveLength(1);
});
it("returns an opaque next link with opt-in results and a bounded per-page request", async () => {
  const next =
    "https://canvas.fixture.invalid/api/v1/courses?opaque=a%2Bb%2Cc&per_page=25";
  const { call, requests } = fixture(
    `<https://canvas.fixture.invalid/api/v1/courses?opaque=current>; rel="current", <${next}>; rel="next"`
  );
  expect(
    (
      await call({
        include_pagination: true,
        per_page: 25,
        enrollment_type: "teacher",
      })
    ).data
  ).toEqual({ items: [{ id: 1 }], next_page_url: next });
  expect(requests[0].params).toEqual({
    per_page: 25,
    enrollment_type: "teacher",
  });
  expect(requests).toHaveLength(1);
});
it("follows the exact opaque endpoint URL once without redirects or filter reconstruction", async () => {
  const url =
    "https://canvas.fixture.invalid/api/v1/courses?cursor=opaque%2B1%2C2";
  const { call, requests } = fixture(undefined, []);
  expect(
    (await call({ include_pagination: true, page_url: url })).data
  ).toEqual({ items: [], next_page_url: null });
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ url, maxRedirects: 0 });
  expect(requests[0].params).toBeUndefined();
});
it.each([
  "https://other.fixture.invalid/api/v1/courses?cursor=x",
  "https://canvas.fixture.invalid/api/v1/users?cursor=x",
  "http://canvas.fixture.invalid/api/v1/courses?cursor=x",
  "https://user:private-token@canvas.fixture.invalid/api/v1/courses",
  "https://canvas.fixture.invalid/api/v1/courses#",
  "https://canvas.fixture.invalid/api/v1/courses?access_token=private-token",
  "/api/v1/courses?cursor=x",
])(
  "rejects an unsafe or unrelated continuation before requests",
  async (page_url) => {
    const { call, requests } = fixture();
    const result = await call({ include_pagination: true, page_url });
    expect(result.isError).toBe(true);
    expect(result.data.error.code).toBe("invalid_input");
    expect(requests).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain("private-token");
  }
);
it.each([
  { per_page: 0 },
  { per_page: 101 },
  { per_page: 1.5 },
  { per_page: "10" },
  { include_pagination: "true" },
  { page_url: "https://canvas.fixture.invalid/api/v1/courses?cursor=x" },
  {
    include_pagination: true,
    page_url: "https://canvas.fixture.invalid/api/v1/courses?cursor=x",
    per_page: 10,
  },
])("rejects invalid pagination options before requests", async (args) => {
  const { call, requests } = fixture();
  expect((await call(args)).isError).toBe(true);
  expect(requests).toHaveLength(0);
});
it("rejects unrelated provider next links without returning their contents", async () => {
  const { call, requests } = fixture(
    '<https://other.fixture.invalid/api/v1/courses?secret=private-token>; rel="next"'
  );
  const result = await call({ include_pagination: true });
  expect(result.isError).toBe(true);
  expect(requests).toHaveLength(1);
  expect(JSON.stringify(result)).not.toContain("private-token");
});
it("does not manufacture array data for an invalid paginated response", async () => {
  const { call } = fixture(undefined, { private: "private-token" });
  const result = await call({ include_pagination: true });
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result)).not.toContain("private-token");
});
it("does not mistake rel text inside a quoted title for a next relation", async () => {
  const { call } = fixture(
    '<https://canvas.fixture.invalid/api/v1/courses?cursor=current>; title="notes, sample; rel=next ; more"; rel="current"'
  );
  expect(
    (await call({ include_pagination: true })).data.next_page_url
  ).toBeNull();
});
it("accepts an unquoted next relation and a comma inside an opaque URL", async () => {
  const next = "https://canvas.fixture.invalid/api/v1/courses?cursor=a,b";
  const { call } = fixture(`<${next}>; rel=next`);
  expect((await call({ include_pagination: true })).data.next_page_url).toBe(
    next
  );
});
it("rejects ambiguous duplicate next links", async () => {
  const { call } = fixture(
    '<https://canvas.fixture.invalid/api/v1/courses?cursor=a>; rel="next", <https://canvas.fixture.invalid/api/v1/courses?cursor=b>; rel="next"'
  );
  const result = await call({ include_pagination: true });
  expect(result.isError).toBe(true);
  expect(result.data.error.code).toBe("invalid_response");
});
it("advertises the opt-in pagination fields and local page-size bounds", () => {
  const registry = new CanvasToolRegistry(
    createCanvasGroups(axios.create()),
    "courses"
  );
  const tool = registry
    .getToolDefinitions()
    .find((tool) => tool.name === "list_courses")!;
  expect(tool.inputSchema.properties).toMatchObject({
    include_pagination: { type: "boolean" },
    per_page: { type: "integer", minimum: 1, maximum: 100 },
    page_url: { type: "string" },
  });
});
