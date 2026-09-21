import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { JevService } from "../../servers/jev/src/service.js";
import { parseInput } from "../../servers/jev/src/input.js";
import {
  chooseNextStep,
  type DecisionPolicy,
} from "../../examples/jev/decision-policy.js";
import type { EvaluationOutput } from "../../servers/jev/src/output.js";
interface Case {
  id: string;
  workflow: string;
  condition: string;
  request: unknown;
  fixtureResponse: unknown;
  policy: DecisionPolicy;
  label: { action: string; reason: string };
}
const cases: Case[] = JSON.parse(
  readFileSync(resolve(__dirname, "../../examples/jev/cases.json"), "utf8")
);
describe("synthetic Jev workflow contracts (not model accuracy)", () => {
  it("covers twelve uniquely labeled cases across all workflows and difficult evidence", () => {
    expect(cases).toHaveLength(12);
    expect(new Set(cases.map((c) => c.id)).size).toBe(12);
    expect(new Set(cases.map((c) => c.workflow))).toEqual(
      new Set(["fury", "finding", "merge"])
    );
    expect(new Set(cases.map((c) => c.condition))).toEqual(
      new Set([
        "clear",
        "ambiguous",
        "insufficient",
        "conflicting",
        "injection",
      ])
    );
    for (const c of cases) expect(c.label.reason.length).toBeGreaterThan(10);
  });
  it("validates every JSON request example in workflow documentation", () => {
    const markdown = readFileSync(
      resolve(__dirname, "../../docs/jev-workflows.md"),
      "utf8"
    );
    const blocks = [...markdown.matchAll(/```json\n([\s\S]*?)\n```/g)];
    expect(blocks).toHaveLength(3);
    for (const block of blocks)
      expect(parseInput(JSON.parse(block[1]))).toEqual(JSON.parse(block[1]));
  });
  for (const c of cases)
    it(`${c.id} preserves the public request and applies the labeled caller policy`, async () => {
      expect(parseInput(c.request)).toEqual(c.request);
      const fetch = vi.fn(async (_url: unknown, options?: RequestInit) => {
        const body = JSON.parse(String(options?.body));
        expect({ state: body.state, questions: body.questions }).toEqual(
          c.request
        );
        return new Response(JSON.stringify(c.fixtureResponse), {
          headers: { "content-type": "application/json" },
        });
      });
      const result = await new JevService(
        { apiKey: "synthetic-only", timeoutMs: 1000 },
        fetch
      ).evaluate(c.request);
      expect(chooseNextStep(result, c.policy)).toBe(c.label.action);
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  it("requires all illustrative thresholds and abstains when metadata is absent", () => {
    const result: EvaluationOutput = {
      requestedModel: "typesafe-ai/jev",
      answers: {
        decision: {
          type: "choice",
          choice: "review",
          probabilities: { review: 0.8, ask_user: 0.2 },
        },
        supported: { type: "boolean", probability: 0.8 },
      },
      confidence: { decision: 0.6 },
    };
    const policy = {
      fallback: "ask_user",
      minimumProbability: 0.8,
      minimumConfidence: 0.6,
      minimumSupport: 0.8,
    };
    expect(chooseNextStep(result, policy)).toBe("review");
    expect(chooseNextStep({ ...result, confidence: undefined }, policy)).toBe(
      "ask_user"
    );
    expect(
      chooseNextStep({ ...result, confidence: { decision: 0.599 } }, policy)
    ).toBe("ask_user");
    expect(
      chooseNextStep(
        {
          ...result,
          answers: {
            ...result.answers,
            decision: { type: "choice", choice: "review" },
          },
        },
        policy
      )
    ).toBe("ask_user");
    expect(
      chooseNextStep(
        {
          ...result,
          answers: {
            ...result.answers,
            supported: { type: "boolean", probability: 0.799 },
          },
        },
        policy
      )
    ).toBe("ask_user");
  });
});
