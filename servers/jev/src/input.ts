import { z } from "zod/v3";
import type { JSONValue } from "@ai-sdk/provider";
import { JevError } from "./errors.js";

export const identifier = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/)
  .refine(
    (value) => !["__proto__", "prototype", "constructor"].includes(value)
  );
const description = z
  .string()
  .max(2048)
  .refine((s) => Buffer.byteLength(s) <= 2048);
const instructions = z
  .string()
  .min(1)
  .max(4096)
  .refine((s) => s.trim().length > 0 && Buffer.byteLength(s) <= 4096);
const question = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("boolean"),
      instructions,
      criteria: z
        .object({ true: description.optional(), false: description.optional() })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("choice"),
      instructions,
      criteria: z
        .record(identifier, description)
        .refine(
          (v) => Object.keys(v).length >= 2 && Object.keys(v).length <= 32
        ),
    })
    .strict(),
  z
    .object({
      type: z.literal("score"),
      instructions,
      criteria: z.array(description).min(2).max(10),
    })
    .strict(),
]);
export const inputSchema = z
  .object({
    state: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]),
    questions: z
      .record(identifier, question)
      .refine((v) => Object.keys(v).length >= 1 && Object.keys(v).length <= 16),
  })
  .strict();
export type EvaluationInput = Omit<z.infer<typeof inputSchema>, "state"> & {
  state: string | Record<string, JSONValue> | JSONValue[];
};

// Bound traversal before JSON.stringify or schema parsing. Never execute getters.
export function checkJson(
  value: unknown,
  byteLimit: number,
  depthLimit: number
): void {
  let budget = byteLimit;
  let nodes = 0;
  const ancestors = new Set<object>();
  const charge = (n: number) => {
    budget -= n;
    if (budget < 0) throw new JevError("INVALID_INPUT");
  };
  function walk(v: unknown, depth: number): void {
    if (depth > depthLimit || ++nodes > byteLimit)
      throw new JevError("INVALID_INPUT");
    if (
      v === null ||
      typeof v === "string" ||
      typeof v === "boolean" ||
      (typeof v === "number" && Number.isFinite(v))
    ) {
      if (typeof v === "string" && v.length > byteLimit)
        throw new JevError("INVALID_INPUT");
      charge(Buffer.byteLength(JSON.stringify(v)));
      return;
    }
    if (
      typeof v !== "object" ||
      v === null ||
      ancestors.has(v) ||
      Object.getOwnPropertySymbols(v).length ||
      (!Array.isArray(v) &&
        Object.getPrototypeOf(v) !== Object.prototype &&
        Object.getPrototypeOf(v) !== null)
    )
      throw new JevError("INVALID_INPUT");
    ancestors.add(v);
    charge(2);
    const keys = Object.getOwnPropertyNames(v).filter(
      (key) => !(Array.isArray(v) && key === "length")
    );
    if (
      Array.isArray(v) &&
      (keys.length !== v.length || keys.some((key, i) => key !== String(i)))
    )
      throw new JevError("INVALID_INPUT");
    keys.forEach((key, i) => {
      const descriptor = Object.getOwnPropertyDescriptor(v, key)!;
      if (!("value" in descriptor) || !descriptor.enumerable)
        throw new JevError("INVALID_INPUT");
      if (i) charge(1);
      if (!Array.isArray(v)) charge(Buffer.byteLength(JSON.stringify(key)) + 1);
      walk(descriptor.value, depth + 1);
    });
    ancestors.delete(v);
  }
  walk(value, 0);
}
export function parseInput(value: unknown): EvaluationInput {
  checkJson(value, 131072, 20);
  const parsed = inputSchema.safeParse(value);
  if (!parsed.success) throw new JevError("INVALID_INPUT");
  // Zod records omit __proto__; state is opaque JSON and must retain its keys.
  const state = (value as { state: EvaluationInput["state"] }).state;
  checkJson(state, 65536, 16);
  return { ...parsed.data, state };
}
