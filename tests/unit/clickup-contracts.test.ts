import { describe, expect, it } from "vitest";
import { ToolSchema } from "@modelcontextprotocol/sdk/types.js";
import { call } from "../fixtures/clickup.js";
import { tools } from "../../servers/clickup/src/tools.js";

const cases: [string, Record<string, unknown>, string, string, unknown?][] = [
  [
    "get_tasks",
    { list_id: "11", page: 0, archived: false },
    "get",
    "/list/11/task",
  ],
  ["get_task", { task_id: "abc" }, "get", "/task/abc"],
  [
    "create_task",
    { list_id: "11", name: "Task", notify_all: false, time_estimate: 100 },
    "post",
    "/list/11/task",
    { name: "Task", notify_all: false, time_estimate: 100 },
  ],
  [
    "update_task",
    {
      task_id: "abc",
      archived: false,
      assignees: { add: ["123"], rem: ["456"] },
    },
    "put",
    "/task/abc",
    { archived: false, assignees: { add: [123], rem: [456] } },
  ],
  ["delete_task", { task_id: "abc" }, "delete", "/task/abc"],
  ["get_task_comments", { task_id: "abc" }, "get", "/task/abc/comment"],
  [
    "create_task_comment",
    { task_id: "abc", comment_text: "Comment", notify_all: false },
    "post",
    "/task/abc/comment",
    { comment_text: "Comment", notify_all: false },
  ],
  ["get_lists", { folder_id: "22", archived: false }, "get", "/folder/22/list"],
  [
    "get_folderless_lists",
    { space_id: "33", archived: false },
    "get",
    "/space/33/list",
  ],
  [
    "create_list",
    { folder_id: "22", name: "List", content: "content" },
    "post",
    "/folder/22/list",
    { name: "List", content: "content" },
  ],
  [
    "create_folderless_list",
    { space_id: "33", name: "List" },
    "post",
    "/space/33/list",
    { name: "List" },
  ],
  [
    "update_list",
    { list_id: "11", name: "Updated" },
    "put",
    "/list/11",
    { name: "Updated" },
  ],
  ["delete_list", { list_id: "11" }, "delete", "/list/11"],
  [
    "get_folders",
    { space_id: "33", archived: false },
    "get",
    "/space/33/folder",
  ],
  [
    "create_folder",
    { space_id: "33", name: "Folder" },
    "post",
    "/space/33/folder",
    { name: "Folder" },
  ],
  [
    "update_folder",
    { folder_id: "22", name: "Renamed" },
    "put",
    "/folder/22",
    { name: "Renamed" },
  ],
  ["delete_folder", { folder_id: "22" }, "delete", "/folder/22"],
  ["get_spaces", { team_id: "44", archived: false }, "get", "/team/44/space"],
  ["get_space", { space_id: "33" }, "get", "/space/33"],
  [
    "create_space",
    { team_id: "44", name: "Space", multiple_assignees: false },
    "post",
    "/team/44/space",
    { name: "Space", multiple_assignees: false },
  ],
  [
    "update_space",
    { space_id: "33", name: "Renamed", multiple_assignees: false },
    "put",
    "/space/33",
    { name: "Renamed", multiple_assignees: false },
  ],
  ["delete_space", { space_id: "33" }, "delete", "/space/33"],
  ["get_teams", {}, "get", "/team"],
  ["get_team_members", { team_id: "44" }, "get", "/team"],
  ["get_user", { team_id: "44", user_id: "123" }, "get", "/team/44/user/123"],
  [
    "get_time_entries",
    { team_id: "44", start_date: "1000", end_date: "2000", assignee: "123" },
    "get",
    "/team/44/time_entries",
  ],
  [
    "create_time_entry",
    { team_id: "44", start: "1000", duration: 50, tid: "abc" },
    "post",
    "/team/44/time_entries",
    { start: 1000, duration: 50, tid: "abc" },
  ],
  [
    "get_goals",
    { team_id: "44", include_completed: false },
    "get",
    "/team/44/goal",
  ],
  [
    "create_goal",
    {
      team_id: "44",
      name: "Goal",
      owners: ["123"],
      due_date: "1000",
      description: "",
      multiple_owners: true,
      color: "#123456",
    },
    "post",
    "/team/44/goal",
    {
      name: "Goal",
      owners: [123],
      due_date: 1000,
      description: "",
      multiple_owners: true,
      color: "#123456",
    },
  ],
];

describe("ClickUp actual provider mappings", () => {
  it("advertises exactly the 29 fixture-covered unique tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual(
      cases.map((c) => c[0]).sort()
    );
    expect(new Set(tools.map((t) => t.name)).size).toBe(29);
    tools.forEach((tool) => ToolSchema.parse(tool));
  });
  it.each(cases)(
    "%s maps method, endpoint, body and raw success",
    async (name, args, method, url, body) => {
      const members = [{ user: { id: 123 } }];
      const data =
        name === "get_team_members"
          ? { teams: [{ id: "44", members }] }
          : { id: "fixture" };
      const { result, value, calls } = await call(name, args, data);
      expect(result.isError).not.toBe(true);
      expect(value).toEqual(
        name === "get_team_members" ? { members } : { id: "fixture" }
      );
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({ method, url });
      expect(
        calls[0].data === undefined ? undefined : JSON.parse(calls[0].data)
      ).toEqual(body);
    }
  );
  it.each(cases)(
    "%s suppresses private provider errors",
    async (name, args) => {
      const { result, value, calls } = await call(
        name,
        args,
        { error: "PRIVATE_PROVIDER_BODY" },
        403
      );
      expect(result.isError).toBe(true);
      expect(value.error.code).toBe("forbidden");
      expect(JSON.stringify(result)).not.toMatch(/PRIVATE/);
      expect(calls).toHaveLength(1);
    }
  );
});
