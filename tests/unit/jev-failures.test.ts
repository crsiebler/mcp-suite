import { afterEach, describe, expect, it, vi } from "vitest";
import { JevService } from "../../servers/jev/src/service.js";
import { parseInput } from "../../servers/jev/src/input.js";
import { errorResult } from "../../servers/jev/src/errors.js";

const input = {
  state: "private-state",
  questions: {
    yes: { type: "boolean", instructions: "private-instructions" },
    choice: {
      type: "choice",
      instructions: "Choose",
      criteria: { a: "A", b: "B", c: "C" },
    },
    score: {
      type: "score",
      instructions: "Score",
      criteria: ["low", "medium", "high"],
    },
  },
};
const answers = {
  yes: { type: "boolean", probability: 0.8 },
  choice: {
    type: "choice",
    choice: "a",
    probabilities: { a: 0.6, b: 0.3, c: 0.1 },
  },
  score: {
    type: "score",
    score: 1.5,
    probabilities: { "0": 0.1, "1": 0.3, "2": 0.6 },
  },
};
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
const config = { apiKey: "private-key", timeoutMs: 100 };
const failure = async (response: () => Promise<Response>, code: string) => {
  const fetch = vi.fn(response);
  const result = await new JevService(config, fetch)
    .evaluate(input)
    .catch(errorResult);
  expect(result).toMatchObject({ isError: true });
  expect(JSON.stringify(result)).toContain(code);
  expect(JSON.stringify(result)).not.toMatch(
    /private-|authorization|raw-response/
  );
  expect(fetch).toHaveBeenCalledTimes(1);
};
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Jev provider failures and privacy", () => {
  it.each([
    [401, "UNAUTHORIZED"],
    [403, "UNAUTHORIZED"],
    [404, "MODEL_UNAVAILABLE"],
    [429, "RATE_LIMITED"],
    [500, "PROVIDER_UNAVAILABLE"],
    [503, "PROVIDER_UNAVAILABLE"],
  ] as const)(
    "maps HTTP %s without retry or private body leakage",
    async (status, code) => {
      const cancelled = vi.fn();
      await failure(
        async () =>
          new Response(
            new ReadableStream({
              start(c) {
                c.enqueue(new TextEncoder().encode("private-response"));
              },
              cancel: cancelled,
            }),
            { status, headers: { "retry-after": "private-header" } }
          ),
        code
      );
      expect(cancelled).toHaveBeenCalledTimes(1);
    }
  );
  it("maps network errors without exposing private causes", () =>
    failure(async () => {
      throw new Error("private-key private-state");
    }, "PROVIDER_UNAVAILABLE"));
  it("rejects malformed JSON", () =>
    failure(async () => new Response("private-response"), "INVALID_RESPONSE"));
  it("rejects warnings before the SDK warning logger receives private text", async () => {
    const warning = vi.spyOn(process, "emitWarning");
    const consoleWarning = vi.spyOn(console, "warn");
    await failure(
      async () =>
        json({
          answers,
          warnings: [
            {
              type: "unsupported",
              feature: "private-feature",
              details: "private-response",
            },
          ],
        }),
      "PROVIDER_WARNING"
    );
    expect(warning).not.toHaveBeenCalled();
    expect(consoleWarning).not.toHaveBeenCalled();
  });
  it.each([
    { answers: {} },
    { answers: { ...answers, extra: answers.yes } },
    { answers: { ...answers, yes: { type: "score", score: 0 } } },
    { answers: { ...answers, yes: { type: "boolean", probability: -0.1 } } },
    { answers: { ...answers, choice: { type: "choice", choice: "missing" } } },
    { answers: { ...answers, choice: { ...answers.choice, choice: "c" } } },
    {
      answers: {
        ...answers,
        choice: { ...answers.choice, probabilities: { a: 0.9, b: 0.1 } },
      },
    },
    {
      answers: {
        ...answers,
        choice: {
          ...answers.choice,
          probabilities: { a: 0.7, b: 0.7, c: 0.1 },
        },
      },
    },
    { answers: { ...answers, score: { ...answers.score, score: 1.9 } } },
    { answers: { ...answers, score: { type: "score", score: 3 } } },
    { answers, rounding: { probabilityDecimals: -1 } },
    { answers, rounding: { probabilityDecimals: 16 } },
    { answers, rounding: { scoreDecimals: 1.5 } },
    { answers, usage: { inputTokens: -1 } },
    { answers, usage: { inputTokens: 1.1 } },
    {
      answers,
      usage: { inputTokens: Number.MAX_SAFE_INTEGER, outputTokens: 1 },
    },
    { answers, providerMetadata: { typesafe: { confidence: { yes: 0.9 } } } },
    { answers, providerMetadata: { typesafe: { confidence: { other: 0.9 } } } },
    {
      answers,
      providerMetadata: { typesafe: { confidence: { choice: 1.1 } } },
    },
    { answers, providerMetadata: { typesafe: { confidence: null } } },
  ] as unknown[])("rejects inconsistent answer or metadata %#", (body) =>
    failure(async () => json(body), "INVALID_RESPONSE")
  );
  it("accepts declared rounding without modifying probabilities or fractional scores", async () => {
    const rounded = {
      ...answers,
      choice: {
        type: "choice",
        choice: "a",
        probabilities: { a: 0.333, b: 0.333, c: 0.333 },
      },
      score: {
        type: "score",
        score: 1,
        probabilities: { "0": 0.333, "1": 0.333, "2": 0.333 },
      },
    };
    const result = await new JevService(config, async () =>
      json({
        answers: rounded,
        rounding: { probabilityDecimals: 3, scoreDecimals: 3 },
      })
    ).evaluate(input);
    expect(result.answers).toEqual(rounded);
    expect(result.rounding).toEqual({
      probabilityDecimals: 3,
      scoreDecimals: 3,
    });
    await failure(async () => json({ answers: rounded }), "INVALID_RESPONSE");
  });
  it.each([false, true])(
    "bounds streamed bodies with Content-Length=%s",
    async (length) => {
      const cancelled = vi.fn();
      await failure(
        async () =>
          new Response(
            new ReadableStream({
              start(c) {
                c.enqueue(new Uint8Array(1048576));
                c.enqueue(new Uint8Array(1));
              },
              cancel: cancelled,
            }),
            { headers: length ? { "content-length": "1048577" } : {} }
          ),
        "RESPONSE_TOO_LARGE"
      );
      expect(cancelled).toHaveBeenCalledTimes(1);
    }
  );
  it("cancels a stalled response body on deadline and frees the slot", async () => {
    const cancelled = vi.fn();
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        async () =>
          new Response(
            new ReadableStream({
              start(c) {
                c.enqueue(new TextEncoder().encode('{"answers":'));
              },
              cancel: cancelled,
            })
          )
      )
      .mockImplementation(async () => json({ answers }));
    const service = new JevService(config, fetch);
    await expect(service.evaluate(input)).rejects.toMatchObject({
      code: "TIMEOUT",
    });
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect((await service.evaluate(input)).answers).toEqual(answers);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([
    "success",
    "http",
    "network",
    "malformed",
    "warning",
    "oversize",
    "cancel",
    "timeout",
  ])("restores both concurrency slots after %s", async (mode) => {
    const gates: Array<(value: Response) => void> = [];
    let count = 0;
    const fetch = vi.fn(async (_url: unknown, options?: RequestInit) => {
      if (++count > 1)
        return new Promise<Response>((resolve) => gates.push(resolve));
      if (mode === "network") throw new Error("private-network");
      if (mode === "http") return new Response("private-body", { status: 503 });
      if (mode === "malformed") return json({ answers: {} });
      if (mode === "warning")
        return json({
          answers,
          warnings: [{ type: "other", message: "private-warning" }],
        });
      if (mode === "oversize") return new Response(new Uint8Array(1048577));
      if (mode === "cancel" || mode === "timeout")
        return new Promise<Response>((_resolve, reject) =>
          options?.signal?.addEventListener(
            "abort",
            () => reject(new Error("private-abort")),
            { once: true }
          )
        );
      return json({ answers });
    });
    const service = new JevService({ ...config, timeoutMs: 1000 }, fetch);
    const controller = new AbortController();
    const first = service.evaluate(input, controller.signal).catch(errorResult);
    if (mode === "cancel") {
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1), {
        interval: 1,
      });
      controller.abort();
    }
    const outcome = await first;
    if (mode === "success") expect(outcome).toHaveProperty("answers");
    else expect(outcome).toHaveProperty("isError", true);
    // Keep both calls pending: one follow-up cannot detect a single leaked slot.
    const next = [
      service.evaluate(input).catch(errorResult),
      service.evaluate(input).catch(errorResult),
    ];
    try {
      await vi.waitFor(() => expect(gates).toHaveLength(2), {
        timeout: 500,
        interval: 1,
      });
      expect(fetch).toHaveBeenCalledTimes(3);
    } finally {
      for (const resolve of gates) resolve(json({ answers }));
      const results = await Promise.all(next);
      service.shutdown();
      for (const result of results) expect(result).toHaveProperty("answers");
    }
  });
  it("aborts both requests on shutdown and rejects new calls", async () => {
    const fetch = vi.fn(
      (_url: unknown, options?: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          options?.signal?.addEventListener(
            "abort",
            () => reject(new Error("private-abort")),
            { once: true }
          )
        )
    );
    const service = new JevService(config, fetch);
    const one = service.evaluate(input).catch(errorResult);
    const two = service.evaluate(input).catch(errorResult);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    service.shutdown();
    expect(JSON.stringify(await one)).toContain("SHUTDOWN");
    expect(JSON.stringify(await two)).toContain("SHUTDOWN");
    await expect(service.evaluate(input)).rejects.toMatchObject({
      code: "SHUTDOWN",
    });
  });
});

describe("Jev input limits", () => {
  const request = (state: unknown) => ({ ...input, state });
  it("enforces UTF-8 state bytes and depth with inclusive boundaries", () => {
    expect(parseInput(request("a".repeat(65534))).state).toHaveLength(65534);
    expect(() => parseInput(request("a".repeat(65535)))).toThrow();
    let state: unknown = "leaf";
    for (let i = 0; i < 16; i++) state = [state];
    expect(parseInput(request(state)).state).toEqual(state);
    expect(() => parseInput(request([state]))).toThrow();
  });
  it("rejects cycles, sparse arrays, nonfinite numbers and getters without evaluation", () => {
    const cycle: unknown[] = [];
    cycle.push(cycle);
    const getter = vi.fn();
    for (const state of [
      cycle,
      [undefined],
      new Array(2),
      { bad: Infinity },
      Object.defineProperty({}, "secret", { enumerable: true, get: getter }),
    ])
      expect(() => parseInput(request(state))).toThrow();
    expect(getter).not.toHaveBeenCalled();
  });
  it("rejects excess questions, options, text and aggregate bytes", () => {
    const boolean = { type: "boolean", instructions: "q" };
    const criteria = Object.fromEntries(
      Array.from({ length: 33 }, (_, i) => [`option_${i}`, "x"])
    );
    const questions = Object.fromEntries(
      Array.from({ length: 17 }, (_, i) => [`q_${i}`, boolean])
    );
    const aggregate = Object.fromEntries(
      Array.from({ length: 16 }, (_, i) => [
        `q_${i}`,
        {
          type: "score",
          instructions: "q",
          criteria: Array(10).fill("a".repeat(2048)),
        },
      ])
    );
    for (const q of [
      questions,
      aggregate,
      { q: { ...boolean, instructions: "é".repeat(2049) } },
      { q: { type: "choice", instructions: "q", criteria } },
      {
        q: {
          type: "score",
          instructions: "q",
          criteria: ["a".repeat(2049), "b"],
        },
      },
      JSON.parse(
        '{"__proto__":{"type":"boolean","instructions":"q"},"q":{"type":"boolean","instructions":"q"}}'
      ),
    ])
      expect(() => parseInput({ ...input, questions: q })).toThrow();
  });
});
