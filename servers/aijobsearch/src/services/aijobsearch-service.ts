import {
  limits,
  validateResponse,
  JobSearchResponseError,
} from "./contract.js";
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

function inputText(value: unknown, field: string, maxBytes: number): string {
  try {
    const text = requireText(value, field);
    if (Buffer.byteLength(text, "utf8") > maxBytes) throw new InputError(field);
    return text;
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
      const taxonomy = inputText(
        args.taxonomy,
        "taxonomy",
        limits.taxonomyBytes
      );
      const context = inputText(args.context, "context", limits.contextBytes);
      this.logger.debug("Extracting skills");

      return await this.request("skills", { taxonomy, context });
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
        if (
          !Array.isArray(args.skills_list) ||
          args.skills_list.length < 1 ||
          args.skills_list.length > limits.skills
        )
          throw new InputError("skills_list");
        const skills = args.skills_list.map((value: unknown) => {
          const skill = inputObject(value, "skills_list");
          return {
            title: inputText(
              skill.title,
              "skills_list.title",
              limits.titleBytes
            ),
            description: inputText(
              skill.description,
              "skills_list.description",
              limits.descriptionBytes
            ),
            taxonomy: inputText(
              skill.taxonomy,
              "skills_list.taxonomy",
              limits.taxonomyBytes
            ),
          };
        });
        requestBody = { type: "skills", context: { skills_list: skills } };
      } else if (args.type === "text") {
        requestBody = {
          type: "text",
          context: inputText(args.context, "context", limits.contextBytes),
        };
      } else {
        throw new InputError("type");
      }

      return await this.request("jobs", requestBody);
    } catch (error: unknown) {
      this.logger.error("Failed to match jobs", error);
      throw error;
    }
  }

  private async request(
    route: "skills" | "jobs",
    body: Record<string, unknown>
  ): Promise<unknown> {
    if (Buffer.byteLength(JSON.stringify(body), "utf8") > limits.requestBytes)
      throw new InputError("arguments");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), limits.timeoutMs);
    try {
      const response = await axios.post<unknown>(
        `${this.config.apiUrl.replace(/\/+$/, "")}/${route}`,
        body,
        {
          headers: {
            Authorization: `Bearer ${this.config.apiToken}`,
            "Content-Type": "application/json",
          },
          timeout: limits.timeoutMs,
          signal: controller.signal,
          maxContentLength: limits.responseBytes,
          maxBodyLength: limits.requestBytes,
          maxRedirects: 0,
        }
      );
      return validateResponse(response.data, route);
    } catch (error: unknown) {
      if (controller.signal.aborted)
        throw Object.assign(new Error("Job-search deadline exceeded"), {
          code: "ETIMEDOUT",
        });
      // Axios size/JSON transport failures have no HTTP response to classify.
      if (
        axios.isAxiosError(error) &&
        error.code === "ERR_BAD_RESPONSE" &&
        !error.response
      )
        throw new JobSearchResponseError();
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
