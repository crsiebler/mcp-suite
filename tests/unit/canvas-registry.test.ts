import { expect, it, vi } from "vitest";
import axios from "axios";
import {
  ListToolsResultSchema,
  CallToolResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  CanvasToolRegistry,
  createCanvasGroups,
} from "../../servers/canvas/src/registry.ts";

const groups = () =>
  createCanvasGroups(
    axios.create({
      adapter: () => {
        throw new Error("Unexpected provider call");
      },
    })
  );
it("derives 185 unique tools and fifteen inventories from real registrations", () => {
  const registry = new CanvasToolRegistry(groups());
  const tools = registry.getToolDefinitions();
  expect(tools).toHaveLength(185);
  expect(new Set(tools.map((t) => t.name)).size).toBe(185);
  expect(Object.keys(registry.getCategoryInventory())).toHaveLength(15);
  expect(Object.values(registry.getCategoryInventory()).flat()).toEqual(
    tools.map((t) => t.name)
  );
  ListToolsResultSchema.parse({ tools });
});
it("exposes only selected categories and deduplicates selection", () => {
  const all = new CanvasToolRegistry(groups());
  const limited = new CanvasToolRegistry(groups(), " courses, pages,courses ");
  expect(limited.getToolDefinitions().map((t) => t.name)).toEqual([
    ...all.getCategoryInventory().courses,
    ...all.getCategoryInventory().pages,
  ]);
});
it.each([
  "",
  " ",
  "unknown",
  "courses,",
  ",pages",
  "Courses",
  "courses,private-selection",
])(
  "rejects invalid category configuration %s without printing its value",
  (selection) => {
    expect(() => new CanvasToolRegistry(groups(), selection)).toThrow(
      "CANVAS_TOOL_CATEGORIES"
    );
    try {
      new CanvasToolRegistry(groups(), selection);
    } catch (error) {
      expect(String(error)).not.toContain("private-selection");
    }
  }
);
it("rejects hidden tools even when called directly", async () => {
  const actual = groups();
  const call = vi.spyOn(actual.users, "handleToolCall");
  const registry = new CanvasToolRegistry(actual, "courses");
  const result = CallToolResultSchema.parse(
    await registry.callTool("get_user", { user_id: "1" })
  );
  expect(result.isError).toBe(true);
  expect(call).not.toHaveBeenCalled();
});
it("rejects duplicate registered names instead of silently routing the first", () => {
  const actual = groups();
  actual.duplicate = actual.courses;
  expect(() => new CanvasToolRegistry(actual)).toThrow("Duplicate Canvas tool");
});
it("returns a safe provider error and a valid result for empty deletion responses", async () => {
  const actual = groups();
  const call = vi.spyOn(actual.courses, "handleToolCall");
  call.mockRejectedValue({
    response: { status: 403, data: { message: "private-student-data" } },
  });
  const registry = new CanvasToolRegistry(actual);
  const result = CallToolResultSchema.parse(
    await registry.callTool("get_course", { course_id: "1" })
  );
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result)).not.toContain("private-student-data");
  call.mockResolvedValue(undefined);
  const empty = CallToolResultSchema.parse(
    await registry.callTool("delete_course", {
      course_id: "1",
      event: "delete",
    })
  );
  expect(empty.content).toEqual([{ type: "text", text: "null" }]);
});
