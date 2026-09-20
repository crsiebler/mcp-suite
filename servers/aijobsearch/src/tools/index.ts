import { McpTool } from "../../../../shared/types/mcp.js";

export const aijobsearchTools: McpTool[] = [
  {
    name: "extract_skills",
    description:
      "Extract skills from text using taxonomy mappings, LLM prompts, and RAG",
    inputSchema: {
      type: "object",
      properties: {
        taxonomy: {
          type: "string",
          minLength: 1,
          pattern: "\\S",
          description: 'Skills taxonomy to use (recommended: "lightcast")',
          default: "lightcast",
        },
        context: {
          type: "string",
          minLength: 1,
          pattern: "\\S",
          description:
            "Job description, resume, or text block to extract skills from",
        },
      },
      required: ["taxonomy", "context"],
    },
  },
  {
    name: "match_jobs",
    description:
      "Find jobs that match skills or text. Use type='skills' with skills_list, or type='text' with context",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          minLength: 1,
          pattern: "\\S",
          enum: ["skills", "text"],
          description:
            "Type of matching: 'skills' for structured skill list, 'text' for resume/descriptive text",
        },
        skills_list: {
          type: "array",
          description: "Array of skills (required when type='skills')",
          items: {
            type: "object",
            properties: {
              title: {
                type: "string",
                minLength: 1,
                pattern: "\\S",
                description: "Skill title",
              },
              description: {
                type: "string",
                minLength: 1,
                pattern: "\\S",
                description: "Skill description",
              },
              taxonomy: {
                type: "string",
                minLength: 1,
                pattern: "\\S",
                description: "Taxonomy name",
                default: "lightcast",
              },
            },
            required: ["title", "description", "taxonomy"],
          },
        },
        context: {
          type: "string",
          minLength: 1,
          pattern: "\\S",
          description: "Resume or text block (required when type='text')",
        },
      },
      required: ["type"],
      oneOf: [
        {
          properties: { type: { enum: ["skills"] } },
          required: ["skills_list"],
        },
        { properties: { type: { enum: ["text"] } }, required: ["context"] },
      ],
    },
  },
];
