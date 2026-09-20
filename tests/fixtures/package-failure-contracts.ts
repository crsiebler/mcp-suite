import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { CallToolResultSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import { expect } from "vitest";

export async function checkFailureContracts(
  server: string,
  client: Client,
  tools: Tool[]
) {
  if (server === "jev") {
    for (const [args, code] of [
      [{}, "INVALID_INPUT"],
      [
        {
          state: "fixture-private-state",
          questions: {
            q: {
              type: "boolean",
              instructions: "fixture-private-instructions",
            },
          },
        },
        "PROVIDER_UNAVAILABLE",
      ],
    ] as const) {
      const result = CallToolResultSchema.parse(
        await client.callTool({
          name: "jev_evaluate",
          arguments: args,
        })
      );
      expect(result.isError).toBe(true);
      const text = result.content[0];
      if (text.type !== "text") throw new Error("Expected text");
      expect(JSON.parse(text.text)).toMatchObject({ error: { code } });
      expect(text.text).not.toMatch(
        /fixture-private|fixture-token|Network access blocked/
      );
    }
  }
  if (server === "canvas") expect(tools).toHaveLength(185);
  if (server === "postgresql") {
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "check_dangerous_operations_allowed",
      "execute_query",
    ]);
    const policy = CallToolResultSchema.parse(
      await client.callTool({
        name: "check_dangerous_operations_allowed",
        arguments: {},
      })
    );
    const policyText = policy.content[0];
    if (policyText.type !== "text") throw new Error("Expected text result");
    expect(JSON.parse(policyText.text)).toMatchObject({ allowed: false });
    for (const args of [{}, { query: "SELECT 1" }]) {
      const failure = CallToolResultSchema.parse(
        await client.callTool({ name: "execute_query", arguments: args })
      );
      expect(failure.isError).toBe(true);
      const text = failure.content[0];
      if (text.type !== "text") throw new Error("Expected text result");
      expect(text.text).not.toContain("Network access blocked");
      expect(text.text).not.toContain("postgresql://");
    }
  }
  if (server === "flight") {
    const names = tools.map((tool) => tool.name);
    expect(names).not.toContain("duffel_cancel_order");
    for (const name of [
      "duffel_quote_order_cancellation",
      "duffel_confirm_order_cancellation",
    ]) {
      expect(names).toContain(name);
      const tool = tools.find((tool) => tool.name === name)!;
      expect(tool.annotations).toMatchObject({
        readOnlyHint: false,
        idempotentHint: false,
      });
      for (const args of [
        {},
        { order_id: "ord_fixture", cancellation_id: "ore_fixture" },
      ]) {
        const response = CallToolResultSchema.parse(
          await client.callTool({ name, arguments: args })
        );
        expect(response.isError).toBe(true);
        const content = response.content[0];
        if (content.type !== "text") throw new Error("Expected text result");
        const body = JSON.parse(content.text);
        expect(body.success).toBe(false);
        expect(body.error.code).toBe(
          "order_id" in args ? "internal_error" : "invalid_input"
        );
        expect(content.text).not.toContain("Network access blocked");
        expect(content.text).not.toContain("synthetic-test-key");
      }
    }
    await expect(
      client.callTool({
        name: "duffel_cancel_order",
        arguments: { order_id: "ord_fixture" },
      })
    ).rejects.toMatchObject({ code: -32601 });
  }
  if (server === "salesforce") {
    const result = CallToolResultSchema.parse(
      await client.callTool({
        name: "salesforce_bulk_delete",
        arguments: { sobject_type: "Account", ids: [] },
      })
    );
    expect(result.isError).toBe(true);
    const content = result.content[0];
    if (content.type !== "text") throw new Error("Expected text result");
    expect(JSON.parse(content.text)).toMatchObject({ success: false });
  }
  if (server === "elasticsearch") {
    expect(tools).toHaveLength(18);
    for (const tool of tools) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: expect.any(Boolean),
      });
      const response = CallToolResultSchema.parse(
        await client.callTool({ name: tool.name, arguments: {} })
      );
      expect(response.isError).toBe(true);
      const content = response.content[0];
      if (content.type !== "text") throw new Error("Expected text result");
      const data = JSON.parse(content.text);
      expect(data).toMatchObject({ success: false });
      if (
        Array.isArray(tool.inputSchema.required) &&
        tool.inputSchema.required.length > 0
      )
        expect(data.error.code).toBe("invalid_input");
      expect(content.text).not.toContain("Network access blocked");
      expect(content.text).not.toContain("fixture-token");
    }
    const search = CallToolResultSchema.parse(
      await client.callTool({
        name: "elasticsearch_search",
        arguments: { index: "fixture", size: 0 },
      })
    );
    expect(search.isError).toBe(true);
  }
  if (server === "clickup") {
    expect(tools).toHaveLength(29);
    for (const tool of tools) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: tool.name.startsWith("get_"),
      });
      const response = CallToolResultSchema.parse(
        await client.callTool({ name: tool.name, arguments: {} })
      );
      expect(response.isError).toBe(true);
      const content = response.content[0];
      if (content.type !== "text") throw new Error("Expected text result");
      expect(JSON.parse(content.text)).toMatchObject({
        success: false,
        error: {
          code: tool.name === "get_teams" ? "internal_error" : "invalid_input",
        },
      });
      expect(content.text).not.toMatch(/Network access blocked|fixture-token/);
    }
    const response = CallToolResultSchema.parse(
      await client.callTool({
        name: "get_task",
        arguments: { task_id: "fixture" },
      })
    );
    expect(response.isError).toBe(true);
  }
}
