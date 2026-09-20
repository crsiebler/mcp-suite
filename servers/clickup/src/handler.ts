import type { AxiosInstance } from "axios";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  InputError,
  failure,
  normalizeFailure,
} from "../../../shared/utils/errors.js";
import { toMcpResult } from "../../../shared/utils/result.js";
import { tools } from "./tools.js";
import { validateArguments } from "./input.js";
import {
  requestClickUp,
  MemberResponseError,
  WorkspaceNotFound,
} from "./provider.js";

export class ClickUpHandler {
  constructor(private api: AxiosInstance) {}
  async callTool(name: string, input: unknown): Promise<CallToolResult> {
    try {
      const tool = tools.find((t) => t.name === name);
      if (!tool) throw new InputError("name");
      const args = validateArguments(tool, input ?? {});
      const data = await requestClickUp(this.api, name, args);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      if (error instanceof MemberResponseError)
        return toMcpResult(failure("invalid_response"));
      if (error instanceof WorkspaceNotFound)
        return toMcpResult(failure("not_found"));
      return toMcpResult(normalizeFailure(error));
    }
  }
}
