import { describe, expect, it, vi } from "vitest";
import { JevService } from "../../servers/jev/src/service.js";
import { parseInput } from "../../servers/jev/src/input.js";
import { jevTools } from "../../servers/jev/src/tools.js";

const request = {
  state: { evidence: ["task complete", "tests passed"] },
  questions: {
    ready: { type: "boolean", instructions: "Is the task complete?" },
    next: {
      type: "choice",
      instructions: "Choose next step",
      criteria: { stop: "Done", ask: "Uncertain" },
    },
    quality: {
      type: "score",
      instructions: "Grade evidence",
      criteria: ["Missing", "Partial", "Complete"],
    },
  },
};
const answers = {
  ready: { type: "boolean", probability: 0.9 },
  next: {
    type: "choice",
    choice: "stop",
    probabilities: { stop: 0.8, ask: 0.2 },
  },
  quality: {
    type: "score",
    score: 1.5,
    probabilities: { "0": 0.1, "1": 0.3, "2": 0.6 },
  },
};
const response = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });

describe("Jev evaluation boundary", () => {
  it("advertises one bounded read-only open-world tool with an output schema", () => {
    expect(jevTools).toHaveLength(1);
    expect(jevTools[0]).toMatchObject({
      name: "jev_evaluate",
      outputSchema: { type: "object" },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    });
  });
  it("publishes schemas clients can validate for mixed inputs and outputs", () => {
    const Ajv = require("ajv");
    const validator = new Ajv();
    const input = validator.compile(jevTools[0].inputSchema);
    const output = validator.compile(jevTools[0].outputSchema);
    expect(input(request)).toBe(true);
    expect(input({ ...request, state: 42 })).toBe(false);
    expect(output({ answers, requestedModel: "typesafe-ai/jev" })).toBe(true);
    expect(
      output({
        answers: { bad: { type: "boolean", probability: 2 } },
        requestedModel: "typesafe-ai/jev",
      })
    ).toBe(false);
    expect(output({ answers, requestedModel: "wrong-model" })).toBe(false);
  });
  it("preserves shared JSON state and exact instructions", () => {
    expect(parseInput(request)).toEqual(request);
    const value = {
      state: ["a", null, 1, true],
      questions: { q: { type: "boolean", instructions: "  exact text  " } },
    };
    expect(parseInput(value)).toEqual(value);
  });
  it.each([
    { ...request, state: null },
    { ...request, state: "é".repeat(32768) },
    { ...request, questions: {} },
    { ...request, model: "other" },
    { ...request, questions: { constructor: request.questions.ready } },
    {
      ...request,
      questions: {
        q: { ...request.questions.next, criteria: { only: "one" } },
      },
    },
    {
      ...request,
      questions: { q: { ...request.questions.quality, criteria: ["one"] } },
    },
    {
      ...request,
      questions: {
        q: { type: "boolean", instructions: "", criteria: { maybe: "maybe" } },
      },
    },
  ] as unknown[])(
    "rejects invalid input before network access %#",
    async (input) => {
      const fetch = vi.fn();
      const service = new JevService(
        { apiKey: "synthetic-key", timeoutMs: 30000 },
        fetch
      );
      await expect(service.evaluate(input)).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
      expect(fetch).not.toHaveBeenCalled();
    }
  );
  it("preserves arbitrary JSON state keys without executing hidden accessors", () => {
    const state = JSON.parse(
      '{"__proto__":{"evidence":"exact"},"constructor":"text"}'
    );
    expect(parseInput({ ...request, state }).state).toEqual(state);
    const hidden = Object.defineProperty({}, "toJSON", {
      get() {
        throw new Error("must not execute");
      },
    });
    expect(() => parseInput({ ...request, state: hidden })).toThrowError(
      "Invalid evaluation input."
    );
  });
  it("bounds time and concurrency, then releases slots after cancellation", async () => {
    const fetch = vi.fn(
      (_url: unknown, options?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(new Error("private-abort")),
            { once: true }
          );
        })
    );
    const service = new JevService(
      { apiKey: "synthetic-key", timeoutMs: 100 },
      fetch
    );
    const controller = new AbortController();
    const first = service
      .evaluate(request, controller.signal)
      .catch((e: { code: string }) => e.code);
    const second = service
      .evaluate(request)
      .catch((e: { code: string }) => e.code);
    await expect(service.evaluate(request)).rejects.toMatchObject({
      code: "OVERLOADED",
    });
    controller.abort();
    expect(await first).toBe("CANCELLED");
    expect(await second).toBe("TIMEOUT");
    service.shutdown();
    await expect(service.evaluate(request)).rejects.toMatchObject({
      code: "SHUTDOWN",
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("uses the real pinned evaluation SDK and returns only validated answers/metadata", async () => {
    const fetch = vi.fn(async () =>
      response({
        answers,
        usage: { inputTokens: 10, outputTokens: 0 },
        providerMetadata: {
          typesafe: {
            confidence: { next: 0.6, quality: 0.4 },
            private: "private-response",
          },
        },
      })
    );
    const service = new JevService(
      { apiKey: "synthetic-key", timeoutMs: 30000 },
      fetch
    );
    expect(await service.evaluate(request)).toEqual({
      answers,
      requestedModel: "typesafe-ai/jev",
      usage: { inputTokens: 10, outputTokens: 0, totalTokens: 10 },
      confidence: { next: 0.6, quality: 0.4 },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://ai-gateway.vercel.sh/v4/ai/evaluation-model");
    expect(new Headers(options.headers).get("ai-model-id")).toBe(
      "typesafe-ai/jev"
    );
    expect(JSON.parse(String(options.body))).toEqual({
      ...request,
      providerOptions: {
        gateway: {
          only: ["typesafe-ai"],
          zeroDataRetention: true,
          disallowPromptTraining: true,
        },
      },
    });
  });
  it("rejects malformed answers through actual SDK validation without retries", async () => {
    const fetch = vi.fn(async () =>
      response({ answers: { ready: answers.ready } })
    );
    const service = new JevService(
      { apiKey: "synthetic-key", timeoutMs: 30000 },
      fetch
    );
    await expect(service.evaluate(request)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("does not fabricate optional distributions or metadata", async () => {
    const fetch = vi.fn(async () =>
      response({
        answers: {
          ready: answers.ready,
          next: { type: "choice", choice: "ask" },
          quality: { type: "score", score: 0.25 },
        },
      })
    );
    const value = await new JevService(
      { apiKey: "synthetic-key", timeoutMs: 30000 },
      fetch
    ).evaluate(request);
    expect(value).toEqual({
      answers: {
        ready: answers.ready,
        next: { type: "choice", choice: "ask" },
        quality: { type: "score", score: 0.25 },
      },
      requestedModel: "typesafe-ai/jev",
    });
  });
});
