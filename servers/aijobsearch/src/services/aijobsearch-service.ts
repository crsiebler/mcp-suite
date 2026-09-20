import { InputError } from "../../../../shared/utils/errors.js";
import { requireText } from "../../../../shared/utils/validation.js";
import axios from "axios";
import { Logger } from "../../../../shared/utils/logger.js";
import { AIJobSearchConfig } from "../types/index.js";

function inputObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new InputError(field);
  return value as Record<string, unknown>;
}

function inputText(value: unknown, field: string): string {
  try {
    return requireText(value, field);
  } catch {
    throw new InputError(field);
  }
}

export class AIJobSearchService {
  private config: AIJobSearchConfig;
  private logger: Logger;

  constructor(config: AIJobSearchConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async extractSkills(input: unknown): Promise<unknown> {
    try {
      const args = inputObject(input, "arguments");
      const taxonomy = inputText(args.taxonomy, "taxonomy");
      const context = inputText(args.context, "context");
      this.logger.debug("Extracting skills");

      const response = await axios.post<unknown>(
        `${this.config.apiUrl}/skills`,
        {
          taxonomy,
          context,
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.apiToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error: unknown) {
      this.logger.error("Failed to extract skills", error);
      throw error;
    }
  }

  async matchJobs(input: unknown): Promise<unknown> {
    try {
      const args = inputObject(input, "arguments");
      this.logger.debug("Matching jobs");

      let requestBody: Record<string, unknown>;
      if (args.type === "skills") {
        if (!Array.isArray(args.skills_list))
          throw new InputError("skills_list");
        const skills = args.skills_list.map((value: unknown) => {
          const skill = inputObject(value, "skills_list");
          return {
            title: inputText(skill.title, "skills_list.title"),
            description: inputText(
              skill.description,
              "skills_list.description"
            ),
            taxonomy: inputText(skill.taxonomy, "skills_list.taxonomy"),
          };
        });
        requestBody = { type: "skills", context: { skills_list: skills } };
      } else if (args.type === "text") {
        requestBody = {
          type: "text",
          context: inputText(args.context, "context"),
        };
      } else {
        throw new InputError("type");
      }

      const response = await axios.post<unknown>(
        `${this.config.apiUrl}/jobs`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${this.config.apiToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error: unknown) {
      this.logger.error("Failed to match jobs", error);
      throw error;
    }
  }
}
