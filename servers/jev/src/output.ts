import { z } from "zod/v3";
import type { EvaluationInput } from "./input.js";
import { identifier } from "./input.js";
import { JevError } from "./errors.js";
import type { experimental_evaluate } from "ai";
const probability = z.number().finite().min(0).max(1);
const distribution = z.record(z.string(), probability);
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const precision = z.number().int().min(0).max(15);
export const outputSchema = z
  .object({
    answers: z.record(
      identifier,
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("boolean"), probability }).strict(),
        z
          .object({
            type: z.literal("choice"),
            choice: identifier,
            probabilities: distribution.optional(),
          })
          .strict(),
        z
          .object({
            type: z.literal("score"),
            score: z.number().finite().min(0).max(9),
            probabilities: distribution.optional(),
          })
          .strict(),
      ])
    ),
    requestedModel: z.literal("typesafe-ai/jev"),
    usage: z
      .object({
        inputTokens: count.optional(),
        outputTokens: count.optional(),
        totalTokens: count.optional(),
      })
      .strict()
      .optional(),
    confidence: z.record(identifier, probability).optional(),
    rounding: z
      .object({
        probabilityDecimals: precision.optional(),
        scoreDecimals: precision.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type EvaluationOutput = z.infer<typeof outputSchema>;
export function projectResult(
  result: Awaited<ReturnType<typeof experimental_evaluate>>,
  input: EvaluationInput
): EvaluationOutput {
  const confidence = result.providerMetadata?.typesafe?.confidence;
  if (
    confidence !== undefined &&
    (confidence === null ||
      Array.isArray(confidence) ||
      typeof confidence !== "object" ||
      Object.keys(confidence).some(
        (id) =>
          !Object.hasOwn(input.questions, id) ||
          input.questions[id].type === "boolean"
      ))
  )
    throw new JevError("INVALID_RESPONSE");
  const usage = Object.fromEntries(
    Object.entries(result.usage).filter(([, value]) => value !== undefined)
  );
  const parsed = outputSchema.safeParse({
    answers: result.answers,
    requestedModel: "typesafe-ai/jev",
    ...(Object.keys(usage).length ? { usage } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    ...(result.rounding ? { rounding: result.rounding } : {}),
  });
  if (!parsed.success) throw new JevError("INVALID_RESPONSE");
  if (Buffer.byteLength(JSON.stringify(parsed.data)) > 131072)
    throw new JevError("RESPONSE_TOO_LARGE");
  return parsed.data;
}
