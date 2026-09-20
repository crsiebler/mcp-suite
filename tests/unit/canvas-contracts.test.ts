import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { expect, it } from "vitest";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  CanvasToolRegistry,
  createCanvasGroups,
} from "../../servers/canvas/src/registry.ts";

// One explicit read and, where available, write contract per category.
const reads = [
  ["courses", "list_courses", {}, "/courses"],
  [
    "enrollments",
    "list_enrollments",
    { context: "course", context_id: "1" },
    "/courses/1/enrollments",
  ],
  ["users", "get_user", { user_id: "1" }, "/users/1"],
  [
    "assignments",
    "get_assignment",
    { course_id: "1", assignment_id: "2" },
    "/courses/1/assignments/2",
  ],
  [
    "submissions",
    "get_submission",
    { course_id: "1", assignment_id: "2", user_id: "3" },
    "/courses/1/assignments/2/submissions/3",
  ],
  [
    "modules",
    "get_module",
    { course_id: "1", module_id: "2" },
    "/courses/1/modules/2",
  ],
  [
    "external_tools",
    "get_external_tool",
    { context: "courses", context_id: "1", tool_id: "2" },
    "/courses/1/external_tools/2",
  ],
  [
    "quizzes",
    "get_quiz",
    { course_id: "1", quiz_id: "2" },
    "/courses/1/quizzes/2",
  ],
  ["admins", "list_account_admins", { account_id: "1" }, "/accounts/1/admins"],
  [
    "grade_change_logs",
    "query_grade_changes_by_course",
    { course_id: "1" },
    "/audit/grade_change/courses/1",
  ],
  ["logins", "list_user_logins", { account_id: "1" }, "/accounts/1/logins"],
  [
    "authentication_providers",
    "list_authentication_providers",
    { account_id: "1" },
    "/accounts/1/authentication_providers",
  ],
  [
    "lti_launch_definitions",
    "list_lti_launch_definitions",
    { course_id: "1" },
    "/courses/1/lti_apps/launch_definitions",
  ],
  [
    "pages",
    "get_course_page",
    { course_id: "1", url_or_id: "page" },
    "/courses/1/pages/page",
  ],
  [
    "grading_standards",
    "get_grading_standard",
    { context_type: "course", context_id: "1", grading_standard_id: "2" },
    "/courses/1/grading_standards/2",
  ],
] as const;
const writes = [
  [
    "courses",
    "create_course",
    { account_id: "1", name: "Fixture" },
    "post",
    "/accounts/1/courses",
    { course: { name: "Fixture" } },
  ],
  [
    "enrollments",
    "update_enrollment",
    { course_id: "1", enrollment_id: "2", task: "conclude" },
    "delete",
    "/courses/1/enrollments/2",
    undefined,
  ],
  [
    "users",
    "update_user",
    { user_id: "1", user_name: "Fixture" },
    "put",
    "/users/1",
    { user: { name: "Fixture", avatar: {} } },
  ],
  [
    "assignments",
    "delete_assignment",
    { course_id: "1", assignment_id: "2" },
    "delete",
    "/courses/1/assignments/2",
    undefined,
  ],
  [
    "submissions",
    "submit_assignment",
    {
      course_id: "1",
      assignment_id: "2",
      submission_type: "online_text_entry",
      body: "Fixture",
    },
    "post",
    "/courses/1/assignments/2/submissions",
    { submission: { submission_type: "online_text_entry", body: "Fixture" } },
  ],
  [
    "modules",
    "create_module",
    { course_id: "1", name: "Fixture" },
    "post",
    "/courses/1/modules",
    { module: { name: "Fixture" } },
  ],
  [
    "external_tools",
    "delete_external_tool",
    { context: "courses", context_id: "1", tool_id: "2" },
    "delete",
    "/courses/1/external_tools/2",
    undefined,
  ],
  [
    "quizzes",
    "create_quiz",
    { course_id: "1", title: "Fixture" },
    "post",
    "/courses/1/quizzes",
    { quiz: { title: "Fixture" } },
  ],
  [
    "admins",
    "remove_account_admin",
    { account_id: "1", user_id: "2" },
    "delete",
    "/accounts/1/admins/2",
    undefined,
  ],
  [
    "logins",
    "delete_user_login",
    { user_id: "1", id: "2" },
    "delete",
    "/users/1/logins/2",
    undefined,
  ],
  [
    "authentication_providers",
    "delete_authentication_provider",
    { account_id: "1", id: "2" },
    "delete",
    "/accounts/1/authentication_providers/2",
    undefined,
  ],
  [
    "pages",
    "create_course_page",
    { course_id: "1", title: "Fixture" },
    "post",
    "/courses/1/pages",
    { wiki_page: { title: "Fixture" } },
  ],
  [
    "grading_standards",
    "create_grading_standard",
    {
      context_type: "course",
      context_id: "1",
      title: "Fixture",
      grading_scheme_entry: [{ name: "A", value: 0.9 }],
    },
    "post",
    "/courses/1/grading_standards",
    {
      title: "Fixture",
      "grading_scheme_entry[0][name]": "A",
      "grading_scheme_entry[0][value]": 0.9,
    },
  ],
] as const;
function fixture(category: string, reject = false) {
  const requests: InternalAxiosRequestConfig[] = [];
  const client = axios.create({
    adapter: async (config) => {
      requests.push(config);
      if (reject)
        throw new AxiosError(
          "private-student-error",
          "ERR_BAD_RESPONSE",
          config,
          undefined,
          {
            status: 403,
            statusText: "Forbidden",
            headers: {},
            config,
            data: { errors: [{ message: "private-student-error" }] },
          }
        );
      return {
        status: 200,
        statusText: "OK",
        headers: {},
        config,
        data: { fixture: true },
      };
    },
  });
  return {
    requests,
    registry: new CanvasToolRegistry(createCanvasGroups(client), category),
  };
}
it.each(reads)("maps %s read %s", async (category, name, args, url) => {
  const { requests, registry } = fixture(category);
  const result = CallToolResultSchema.parse(
    await registry.callTool(name, args)
  );
  expect(result.isError).not.toBe(true);
  expect(result.content).toEqual([{ type: "text", text: '{"fixture":true}' }]);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ method: "get", url });
});
it.each(writes)(
  "maps %s write %s with a fixture only",
  async (category, name, args, method, url, body) => {
    const { requests, registry } = fixture(category);
    const result = CallToolResultSchema.parse(
      await registry.callTool(name, args)
    );
    expect(result.isError).not.toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method, url });
    expect(
      requests[0].data === undefined ? undefined : JSON.parse(requests[0].data)
    ).toEqual(body);
    if (name === "update_enrollment")
      expect(requests[0].params).toEqual({ task: "conclude" });
  }
);
it.each(reads)(
  "normalizes %s provider errors without private text",
  async (category, name, args) => {
    const { registry } = fixture(category, true);
    const result = CallToolResultSchema.parse(
      await registry.callTool(name, args)
    );
    expect(result.isError).toBe(true);
    const content = result.content[0];
    if (content.type !== "text") throw new Error("Expected text");
    expect(JSON.parse(content.text)).toMatchObject({
      success: false,
      error: { code: "forbidden" },
    });
    expect(content.text).not.toContain("private-student-error");
  }
);
