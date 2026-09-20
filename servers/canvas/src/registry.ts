import { CanvasPageResponseError } from "./services/course-pagination.js";
import {
  ToolSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { McpTool } from "../../../shared/types/mcp.js";
import { ConfigurationError } from "../../../shared/utils/config.js";
import {
  InputError,
  normalizeFailure,
  failure,
} from "../../../shared/utils/errors.js";
import { toMcpResult } from "../../../shared/utils/result.js";
import type { AxiosInstance } from "axios";
import { CourseService } from "./services/course-service.js";
import { EnrollmentService } from "./services/enrollment-service.js";
import { UserService } from "./services/user-service.js";
import { AssignmentService } from "./services/assignment-service.js";
import { SubmissionService } from "./services/submission-service.js";
import { ModuleService } from "./services/module-service.js";
import { ExternalToolService } from "./services/external-tool-service.js";
import { QuizService } from "./services/quiz-service.js";
import { AdminService } from "./services/admin-service.js";
import { GradeChangeLogService } from "./services/grade-change-log-service.js";
import { LoginService } from "./services/login-service.js";
import { AuthenticationProviderService } from "./services/authentication-provider-service.js";
import { LtiLaunchDefinitionService } from "./services/lti-launch-definition-service.js";
import { PageService } from "./services/page-service.js";
import { GradingStandardService } from "./services/grading-standard-service.js";
import { CourseTools } from "./tools/course-tools.js";
import { EnrollmentTools } from "./tools/enrollment-tools.js";
import { UserTools } from "./tools/user-tools.js";
import { AssignmentTools } from "./tools/assignment-tools.js";
import { SubmissionTools } from "./tools/submission-tools.js";
import { ModuleTools } from "./tools/module-tools.js";
import { ExternalToolTools } from "./tools/external-tool-tools.js";
import { QuizTools } from "./tools/quiz-tools.js";
import { AdminTools } from "./tools/admin-tools.js";
import { GradeChangeLogTools } from "./tools/grade-change-log-tools.js";
import { LoginTools } from "./tools/login-tools.js";
import { AuthenticationProviderTools } from "./tools/authentication-provider-tools.js";
import { LtiLaunchDefinitionTools } from "./tools/lti-launch-definition-tools.js";
import { PageTools } from "./tools/page-tools.js";
import { GradingStandardTools } from "./tools/grading-standard-tools.js";

export interface CanvasToolGroup {
  getToolDefinitions(): Array<{
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
  }>;
  handleToolCall(name: string, args: any): Promise<unknown>;
}
export function createCanvasGroups(
  client: AxiosInstance
): Record<string, CanvasToolGroup> {
  return {
    courses: new CourseTools(new CourseService(client)),
    enrollments: new EnrollmentTools(new EnrollmentService(client)),
    users: new UserTools(new UserService(client)),
    assignments: new AssignmentTools(new AssignmentService(client)),
    submissions: new SubmissionTools(new SubmissionService(client)),
    modules: new ModuleTools(new ModuleService(client)),
    external_tools: new ExternalToolTools(new ExternalToolService(client)),
    quizzes: new QuizTools(new QuizService(client)),
    admins: new AdminTools(new AdminService(client)),
    grade_change_logs: new GradeChangeLogTools(
      new GradeChangeLogService(client)
    ),
    logins: new LoginTools(new LoginService(client)),
    authentication_providers: new AuthenticationProviderTools(
      new AuthenticationProviderService(client)
    ),
    lti_launch_definitions: new LtiLaunchDefinitionTools(
      new LtiLaunchDefinitionService(client)
    ),
    pages: new PageTools(new PageService(client)),
    grading_standards: new GradingStandardTools(
      new GradingStandardService(client)
    ),
  };
}

export class CanvasToolRegistry {
  private readonly tools = new Map<
    string,
    { definition: McpTool; group: CanvasToolGroup }
  >();
  private readonly inventory: Record<string, string[]> = {};

  constructor(groups: Record<string, CanvasToolGroup>, selection?: string) {
    const categories =
      selection === undefined
        ? Object.keys(groups)
        : [...new Set(selection.split(",").map((value) => value.trim()))];
    if (categories.some((name) => !name || !Object.hasOwn(groups, name))) {
      throw new ConfigurationError("CANVAS_TOOL_CATEGORIES");
    }
    const names = new Set<string>();
    for (const [category, group] of Object.entries(groups)) {
      const definitions = group
        .getToolDefinitions()
        .map((tool) => ToolSchema.parse(tool));
      this.inventory[category] = definitions.map((tool) => tool.name);
      for (const definition of definitions) {
        if (names.has(definition.name))
          throw new Error("Duplicate Canvas tool registration");
        names.add(definition.name);
        if (categories.includes(category))
          this.tools.set(definition.name, { definition, group });
      }
    }
  }

  getToolDefinitions(): McpTool[] {
    return [...this.tools.values()].map(({ definition }) => definition);
  }

  getCategoryInventory(): Record<string, string[]> {
    return structuredClone(this.inventory);
  }

  async callTool(name: string, input: unknown): Promise<CallToolResult> {
    try {
      const registration = this.tools.get(name);
      if (!registration) throw new InputError("name");
      const args = input ?? {};
      if (typeof args !== "object" || Array.isArray(args))
        throw new InputError("arguments");
      const data = await registration.group.handleToolCall(name, args);
      // Several existing Canvas DELETE methods intentionally return void.
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data === undefined ? null : data),
          },
        ],
      };
    } catch (error) {
      if (error instanceof CanvasPageResponseError)
        return toMcpResult(failure("invalid_response"));
      return toMcpResult(normalizeFailure(error));
    }
  }
}
