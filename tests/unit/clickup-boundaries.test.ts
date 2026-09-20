import { describe, expect, it } from "vitest";
import { call, fixture } from "../fixtures/clickup.js";
import { tools } from "../../servers/clickup/src/tools.js";

describe("ClickUp validation and provider failure contracts", () => {
  it.each([
    ["get_tasks", {}],
    ["get_tasks", { list_id: "1", folder_id: "2" }],
    ["get_tasks", { folder_id: "2" }],
    ["get_tasks", { space_id: "3", team_id: "4", archived: true }],
    ...[-1, 0.5, "0", NaN, Infinity].map((page) => [
      "get_tasks",
      { list_id: "1", page },
    ]),
    ["get_task", { task_id: "abc", custom_task_ids: true }],
    ["get_user", { user_id: "1" }],
    ["get_task", { task_id: "../user" }],
    ["get_task", { task_id: "." }],
    ["get_task", { task_id: "x?private=yes" }],
    ["get_task", { task_id: 123 }],
    ["get_task", { task_id: "" }],
    ["create_task", { list_id: "1", name: " " }],
    ["create_task", { list_id: "1", name: "Task", assignees: ["bad"] }],
    ["update_task", { task_id: "abc", archived: "false" }],
    ["update_task", { task_id: "abc", assignees: { add: ["1"], rem: false } }],
    ["get_task_comments", { task_id: "abc", start: 1 }],
    ["get_task_comments", { task_id: "abc", start_id: "123" }],
    ["create_time_entry", { team_id: "4", start: "abc", duration: 1 }],
    ["create_time_entry", { team_id: "4", start: "0", duration: 0.5 }],
    ["get_time_entries", { team_id: "4", start_date: "2", end_date: "1" }],
    ["create_goal", { team_id: "4", name: "Goal" }],
    ["get_teams", []],
    ["unknown", {}],
  ] as [string, unknown][])(
    "rejects invalid %s arguments before I/O (%j)",
    async (name, args) => {
      const { result, value, calls } = await call(name, args);
      expect(result.isError).toBe(true);
      expect(value.error.code).toBe("invalid_input");
      expect(calls).toHaveLength(0);
    }
  );
  it.each(
    tools.filter(
      (t) =>
        Array.isArray(t.inputSchema.required) && t.inputSchema.required.length
    )
  )("validates required fields for $name", async (tool) => {
    const { result, value, calls } = await call(tool.name, {});
    expect(result.isError).toBe(true);
    expect(value.error.code).toBe("invalid_input");
    expect(calls).toHaveLength(0);
  });
  it.each([
    [400, "provider_error"],
    [401, "authentication"],
    [403, "forbidden"],
    [404, "not_found"],
    [429, "rate_limited"],
    [503, "unavailable"],
  ])("classifies HTTP %s without private payload", async (status, code) => {
    const { result, value, calls } = await call(
      "get_task",
      { task_id: "abc" },
      { err: "PRIVATE_BODY", token: "PRIVATE_TOKEN" },
      status as number
    );
    expect(result.isError).toBe(true);
    expect(value.error.code).toBe(code);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE/);
    expect(calls).toHaveLength(1);
    if ([429, 503].includes(status as number))
      expect(value.error.retryAfterSeconds).toBe(2);
  });
  it("does not retry an uncertain mutation timeout", async () => {
    const f = fixture();
    let count = 0;
    f.api.defaults.adapter = async () => {
      count++;
      throw Object.assign(new Error("PRIVATE"), { code: "ETIMEDOUT" });
    };
    const result = await f.handler.callTool("delete_task", { task_id: "abc" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('"timeout"');
    expect(result.content[0].text).not.toContain("PRIVATE");
    expect(count).toBe(1);
  });
  it("advertises accurate mutation hints", () => {
    for (const tool of tools) {
      const read = tool.name.startsWith("get_");
      expect(tool.annotations).toMatchObject({
        readOnlyHint: read,
        destructiveHint:
          tool.name.startsWith("update_") || tool.name.startsWith("delete_"),
        idempotentHint: read,
        openWorldHint: true,
      });
    }
  });
  it("rejects malformed member inventory without returning other workspaces", async () => {
    const { result, value } = await call(
      "get_team_members",
      { team_id: "4" },
      {
        teams: [
          { id: "4", members: null },
          { id: "5", members: ["PRIVATE"] },
        ],
      }
    );
    expect(result.isError).toBe(true);
    expect(value.error.code).toBe("invalid_response");
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("reports an inaccessible workspace rather than empty members", async () => {
    const { result, value } = await call(
      "get_team_members",
      { team_id: "4" },
      { teams: [] }
    );
    expect(result.isError).toBe(true);
    expect(value.error.code).toBe("not_found");
  });
});

describe("ClickUp pagination and payload preservation", () => {
  it.each([
    ["folder_id", "project_ids"],
    ["space_id", "space_ids"],
  ])("uses workspace filtering for %s", async (key, filter) => {
    const data = { tasks: [{ id: "abc" }], last_page: false };
    const { calls, value, api } = await call(
      "get_tasks",
      {
        [key]: "22",
        team_id: "44",
        page: 2,
        statuses: ["in progress"],
        assignees: ["123"],
        include_closed: false,
      },
      data
    );
    expect(value).toEqual(data);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: "/team/44/task",
      params: {
        [filter]: ["22"],
        page: 2,
        statuses: ["in progress"],
        assignees: ["123"],
        include_closed: false,
      },
    });
    const url = api.getUri(calls[0]);
    expect(url).toContain(filter + "[]=22");
    expect(url).toContain("statuses[]=in+progress");
  });
  it("keeps empty list pages and sends page zero / false flags", async () => {
    const { value, calls } = await call(
      "get_tasks",
      {
        list_id: "11",
        page: 0,
        archived: false,
        reverse: false,
        subtasks: false,
      },
      { tasks: [], last_page: true }
    );
    expect(value).toEqual({ tasks: [], last_page: true });
    expect(calls[0].params).toEqual({
      page: 0,
      archived: false,
      reverse: false,
      subtasks: false,
    });
  });
  it("passes both comment cursors and retains provider metadata", async () => {
    const data = { comments: [{ id: "123", date: "1000" }] };
    const { value, calls } = await call(
      "get_task_comments",
      { task_id: "abc", start: 1000, start_id: "123" },
      data
    );
    expect(value).toEqual(data);
    expect(calls).toHaveLength(1);
    expect(calls[0].params).toEqual({ start: 1000, start_id: "123" });
  });
  it("ignores undocumented arguments even when they resemble another tool's fields", async () => {
    const { result, calls } = await call("get_task", {
      task_id: "abc",
      owners: { unexpected: true },
      start: false,
      user_id: 99,
    });
    expect(result.isError).not.toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].params).toEqual({});
  });
  it("preserves zero values and empty editable text", async () => {
    const { calls } = await call("create_time_entry", {
      team_id: "4",
      start: "0",
      duration: 0,
      description: "",
      assignee: "123",
    });
    expect(JSON.parse(calls[0].data)).toEqual({
      start: 0,
      duration: 0,
      description: "",
      assignee: 123,
    });
    const updated = await call("update_task", {
      task_id: "abc",
      description: "",
      due_date: "0",
      due_date_time: false,
    });
    expect(JSON.parse(updated.calls[0].data)).toEqual({
      description: "",
      due_date: 0,
      due_date_time: false,
    });
  });
});
