import axios, { type InternalAxiosRequestConfig } from "axios";
import { expect, it } from "vitest";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  createCanvasGroups,
  CanvasToolRegistry,
} from "../../servers/canvas/src/registry.ts";

// Synthetic values exercise actual dispatch and service calls, not live Canvas.
function example(schema: any): unknown {
  if (schema.enum) return schema.enum[0];
  switch (schema.type) {
    case "string":
      return "fixture";
    case "number":
    case "integer":
      return 1;
    case "boolean":
      return false;
    case "array":
      return schema.items ? [example(schema.items)] : [];
    case "object":
      return Object.fromEntries(
        Object.entries(schema.properties ?? {}).map(([key, child]) => [
          key,
          example(child),
        ])
      );
    default:
      return "fixture";
  }
}
const requests: InternalAxiosRequestConfig[] = [];
const registry = new CanvasToolRegistry(
  createCanvasGroups(
    axios.create({
      adapter: async (config) => {
        requests.push(config);
        return {
          status: 200,
          statusText: "OK",
          headers: {},
          config,
          data: { fixture: true },
        };
      },
    })
  )
);
for (const [category, names] of Object.entries(
  registry.getCategoryInventory()
)) {
  for (const name of names) {
    it(`${category}/${name} reaches its actual handler and provider boundary`, async () => {
      requests.length = 0;
      const definition = registry
        .getToolDefinitions()
        .find((tool) => tool.name === name)!;
      const args = example(definition.inputSchema) as Record<string, unknown>;
      // Opaque continuation URLs need dedicated endpoint-aware fixtures.
      if (name === "list_courses") {
        delete args.page_url;
        delete args.include_pagination;
        delete args.per_page;
      }
      const result = CallToolResultSchema.parse(
        await registry.callTool(name, args)
      );
      expect(result.isError).not.toBe(true);
      expect(requests.length).toBeGreaterThan(0);
      for (const request of requests)
        expect(request.url).not.toContain("undefined");
    });
  }
}
