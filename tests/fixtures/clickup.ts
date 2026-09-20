import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { ClickUpHandler } from "../../servers/clickup/src/handler.js";
export function fixture(data: unknown = { id: "fixture" }, status?: number) {
  const calls: InternalAxiosRequestConfig[] = [];
  const api = axios.create({
    baseURL: "https://api.clickup.com/api/v2",
    adapter: async (config) => {
      calls.push(config);
      const response = {
        config,
        data,
        status: status ?? 200,
        statusText: "fixture",
        headers: { "retry-after": "2" },
      };
      if (status)
        throw new AxiosError(
          "PRIVATE_ERROR",
          "ERR_BAD_RESPONSE",
          config,
          undefined,
          response
        );
      return response;
    },
  });
  return { handler: new ClickUpHandler(api), calls, api };
}
export async function call(
  name: string,
  args: unknown,
  data?: unknown,
  status?: number
) {
  const f = fixture(data, status);
  const result = await f.handler.callTool(name, args);
  CallToolResultSchema.parse(result);
  return { ...f, result, value: JSON.parse(result.content[0].text as string) };
}
