import { zodToJsonSchema } from "zod-to-json-schema";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { inputSchema } from "./input.js";
import { outputSchema } from "./output.js";
export const jevTools: Tool[] = [
  {
    name: "jev_evaluate",
    description:
      "Evaluate supplied shared JSON state with Jev through Vercel AI Gateway. Returns typed answers and optional probabilities/confidence; does not generate code or grant approval. Sends data externally and may incur charges. State <=64 KiB/depth16; 1–16 questions; instructions <=4 KiB, descriptions <=2 KiB UTF-8; 2–32 choice options or 2–10 score levels; combined input <=128 KiB. No implicit file or URL reads.",
    inputSchema: zodToJsonSchema(inputSchema, {
      $refStrategy: "none",
    }) as Tool["inputSchema"],
    outputSchema: zodToJsonSchema(outputSchema, {
      $refStrategy: "none",
    }) as Tool["outputSchema"],
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
      idempotentHint: false,
    },
  },
];
