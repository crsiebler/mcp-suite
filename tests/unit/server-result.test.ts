import {
  CallToolResultSchema,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { expect, it } from "vitest";
import { normalizeFailure, InputError } from "../../shared/utils/errors.ts";
import { toMcpResult } from "../../shared/utils/result.ts";
import { aijobsearchTools } from "../../servers/aijobsearch/src/tools/index.ts";
import { tools as elasticTools } from "../../servers/elasticsearch/src/tools/index.ts";

it.each([
  [401, "authentication"],
  [403, "forbidden"],
  [404, "not_found"],
  [429, "rate_limited"],
  [503, "unavailable"],
  [418, "provider_error"],
])("maps HTTP %s without copying private payloads", (status, code) => {
  const failure = normalizeFailure({
    message: "private-message",
    response: {
      status,
      data: { error: "private-body" },
      headers: { authorization: "private-header" },
    },
  });
  expect(failure).toMatchObject({ success: false, error: { code } });
  expect(JSON.stringify(failure)).not.toContain("private-");
  expect(CallToolResultSchema.safeParse(toMcpResult(failure)).success).toBe(
    true
  );
});
it.each(["ETIMEDOUT", "ECONNABORTED"])(
  "classifies %s as an uncertain timeout",
  (code) => {
    expect(normalizeFailure({ code })).toMatchObject({
      error: { code: "timeout", message: expect.stringContaining("unknown") },
    });
  }
);
it("preserves numeric and HTTP-date Retry-After without inventing retries", () => {
  expect(
    normalizeFailure({
      response: { status: 429, headers: { "retry-after": "30" } },
    }).error.retryAfterSeconds
  ).toBe(30);
  expect(
    normalizeFailure(
      {
        response: {
          status: 503,
          headers: { "Retry-After": "Tue, 01 Jan 2030 00:00:30 GMT" },
        },
      },
      Date.parse("2030-01-01T00:00:00Z")
    ).error.retryAfterSeconds
  ).toBe(30);
  expect(
    normalizeFailure({
      response: { status: 429, headers: { "retry-after": "private-invalid" } },
    }).error.retryAfterSeconds
  ).toBeUndefined();
});
it("normalizes input and unknown failures without serializing arbitrary rejections", () => {
  expect(normalizeFailure(new InputError("context"))).toMatchObject({
    error: {
      code: "invalid_input",
      message: expect.stringContaining("context"),
    },
  });
  for (const value of [
    "private-rejection",
    null,
    1,
    new Error("private-error"),
    new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error("private-proxy");
        },
      }
    ),
  ]) {
    const result = normalizeFailure(value);
    expect(result.error.code).toBe("internal_error");
    expect(JSON.stringify(result)).not.toContain("private-");
  }
});
it("returns SDK-valid success/error envelopes and handles unserializable data", () => {
  const data = { skills_list: [] };
  const success = toMcpResult({ success: true, data });
  expect(CallToolResultSchema.parse(success).isError).toBe(false);
  expect(success.content[0]).toEqual({
    type: "text",
    text: JSON.stringify({ success: true, data }),
  });
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  const failure = toMcpResult({ success: true, data: circular });
  expect(CallToolResultSchema.parse(failure).isError).toBe(true);
  expect(JSON.stringify(failure)).toContain("invalid_response");
});
it("validates shared MCP tool descriptions against the installed SDK schema", () => {
  for (const tool of [...aijobsearchTools, ...elasticTools])
    expect(ToolSchema.safeParse(tool).success).toBe(true);
});

it.each(["-1", "1.5", "2030", "2147483648", "Wed, 31 Apr 2030 00:00:30 GMT"])(
  "validates Retry-After syntax and bounds: %s",
  (value) => {
    // A plain integer is a delay, not a year; 2030 is valid and handled separately.
    if (value === "2030") {
      expect(
        normalizeFailure({
          response: { status: 429, headers: { "retry-after": value } },
        }).error.retryAfterSeconds
      ).toBe(2030);
      return;
    }
    expect(
      normalizeFailure({
        response: { status: 429, headers: { "retry-after": value } },
      }).error.retryAfterSeconds
    ).toBeUndefined();
  }
);

it("reads Retry-After case-insensitively without invoking accessors", () => {
  expect(
    normalizeFailure({
      response: { status: 429, headers: { "RETRY-AFTER": "40" } },
    }).error.retryAfterSeconds
  ).toBe(40);
  const getter = () => {
    throw new Error("private-accessor");
  };
  const headers = Object.defineProperty({}, "retry-after", {
    get: getter,
    enumerable: true,
  });
  expect(
    normalizeFailure({ response: { status: 429, headers } }).error.code
  ).toBe("rate_limited");
});

it.each([
  () => undefined,
  Symbol("private-symbol"),
  { toJSON: () => undefined },
])("rejects data silently omitted by JSON serialization: %s", (data) => {
  const result = CallToolResultSchema.parse(
    toMcpResult({ success: true, data })
  );
  expect(result.isError).toBe(true);
  const content = result.content[0];
  if (content.type !== "text") throw new Error("Expected text");
  expect(JSON.parse(content.text)).toMatchObject({
    success: false,
    error: { code: "invalid_response" },
  });
});
it.each([null, 0, false, "fixture", [1, 2], { value: 1 }])(
  "preserves JSON-compatible success data: %s",
  (data) => {
    const result = CallToolResultSchema.parse(
      toMcpResult({ success: true, data })
    );
    expect(result.isError).toBe(false);
    const content = result.content[0];
    if (content.type !== "text") throw new Error("Expected text");
    expect(JSON.parse(content.text)).toEqual({ success: true, data });
  }
);
