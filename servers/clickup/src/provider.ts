import type { AxiosInstance } from "axios";
import type { Arguments } from "./input.js";
import { decimal } from "./input.js";

// Only mappings for the existing 29 public tools. Authentication belongs to index.ts.
type Route = ["get" | "post" | "put" | "delete", string, string?];
const routes: Record<string, Route> = {
  get_task: [
    "get",
    "/task/:task_id",
    "custom_task_ids team_id include_subtasks",
  ],
  create_task: [
    "post",
    "/list/:list_id/task",
    "name description assignees tags status priority due_date due_date_time time_estimate start_date start_date_time notify_all parent",
  ],
  update_task: [
    "put",
    "/task/:task_id",
    "name description status priority due_date due_date_time assignees archived",
  ],
  delete_task: ["delete", "/task/:task_id"],
  get_task_comments: ["get", "/task/:task_id/comment", "start start_id"],
  create_task_comment: [
    "post",
    "/task/:task_id/comment",
    "comment_text notify_all",
  ],
  get_lists: ["get", "/folder/:folder_id/list", "archived"],
  get_folderless_lists: ["get", "/space/:space_id/list", "archived"],
  create_list: ["post", "/folder/:folder_id/list", "name content"],
  create_folderless_list: ["post", "/space/:space_id/list", "name content"],
  update_list: ["put", "/list/:list_id", "name content"],
  delete_list: ["delete", "/list/:list_id"],
  get_folders: ["get", "/space/:space_id/folder", "archived"],
  create_folder: ["post", "/space/:space_id/folder", "name"],
  update_folder: ["put", "/folder/:folder_id", "name"],
  delete_folder: ["delete", "/folder/:folder_id"],
  get_spaces: ["get", "/team/:team_id/space", "archived"],
  get_space: ["get", "/space/:space_id"],
  create_space: ["post", "/team/:team_id/space", "name multiple_assignees"],
  update_space: [
    "put",
    "/space/:space_id",
    "name color private multiple_assignees",
  ],
  delete_space: ["delete", "/space/:space_id"],
  get_teams: ["get", "/team"],
  get_team_members: ["get", "/team"],
  get_user: ["get", "/team/:team_id/user/:user_id"],
  get_time_entries: [
    "get",
    "/team/:team_id/time_entries",
    "start_date end_date assignee",
  ],
  create_time_entry: [
    "post",
    "/team/:team_id/time_entries",
    "start duration description assignee tid",
  ],
  get_goals: ["get", "/team/:team_id/goal", "include_completed"],
  create_goal: [
    "post",
    "/team/:team_id/goal",
    "name due_date description multiple_owners owners color",
  ],
};
function pick(args: Arguments, keys = ""): Arguments {
  return Object.fromEntries(
    keys
      .split(" ")
      .filter((k) => args[k] !== undefined)
      .map((k) => [k, args[k]])
  );
}
function bodyFields(fields: Arguments): Arguments {
  const data = { ...fields };
  for (const key of ["due_date", "start_date", "start", "assignee"])
    if (data[key] !== undefined) data[key] = decimal(data[key], key);
  for (const key of ["owners", "assignees"])
    if (Array.isArray(data[key]))
      data[key] = (data[key] as string[]).map((v) => decimal(v, key));
  if (data.assignees && !Array.isArray(data.assignees)) {
    const changes = data.assignees as Arguments;
    data.assignees = {
      add: ((changes.add ?? []) as string[]).map((v) =>
        decimal(v, "assignees")
      ),
      rem: ((changes.rem ?? []) as string[]).map((v) =>
        decimal(v, "assignees")
      ),
    };
  }
  return data;
}
export class MemberResponseError extends Error {}
export class WorkspaceNotFound extends Error {}

export async function requestClickUp(
  api: AxiosInstance,
  name: string,
  args: Arguments
): Promise<unknown> {
  let route = routes[name];
  let params: Arguments | undefined;
  if (name === "get_tasks") {
    route = [
      "get",
      args.list_id ? "/list/:list_id/task" : "/team/:team_id/task",
    ];
    params = pick(
      args,
      "archived page order_by reverse subtasks statuses include_closed assignees"
    );
    if (args.folder_id) params.project_ids = [args.folder_id];
    if (args.space_id) params.space_ids = [args.space_id];
  }
  if (!route) throw new Error("Missing ClickUp route");
  const [method, path, keys] = route;
  const fields = pick(args, keys);
  const url = path.replace(/:([a-z_]+)/g, (_, key: string) =>
    encodeURIComponent(String(args[key]))
  );
  const response = await api.request({
    method,
    url,
    ...(method === "get" ? { params: params ?? fields } : {}),
    ...(["post", "put"].includes(method) ? { data: bodyFields(fields) } : {}),
  });
  if (name !== "get_team_members") return response.data ?? null;
  const data: unknown = response.data;
  if (
    !data ||
    typeof data !== "object" ||
    !("teams" in data) ||
    !Array.isArray(data.teams)
  )
    throw new MemberResponseError();
  const team = data.teams.find(
    (t) => t && typeof t === "object" && String(t.id) === args.team_id
  );
  if (!team) throw new WorkspaceNotFound();
  if (!Array.isArray(team.members)) throw new MemberResponseError();
  return { members: team.members };
}
