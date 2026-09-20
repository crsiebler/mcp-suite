import type { Skill } from "../types/index.js";

// Local safeguards, not verified ASU provider limits.
export const limits = {
  timeoutMs: 30000,
  requestBytes: 262144,
  responseBytes: 1048576,
  contextBytes: 65536,
  taxonomyBytes: 256,
  titleBytes: 1024,
  descriptionBytes: 4096,
  skills: 100,
} as const;

export class JobSearchResponseError extends Error {
  constructor() {
    super("Invalid job-search response");
  }
}
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const number = (v: unknown) => typeof v === "number" && Number.isFinite(v);
function skill(v: unknown): v is Skill {
  return (
    object(v) &&
    typeof v.title === "string" &&
    typeof v.description === "string" &&
    typeof v.taxonomy_reference_link === "string" &&
    number(v.match_relevance)
  );
}

/** Provisional repository interface only; no published provider schema was found. */
export function validateResponse(
  data: unknown,
  route: "skills" | "jobs"
): unknown {
  try {
    if (
      !object(data) ||
      Buffer.byteLength(JSON.stringify(data), "utf8") > limits.responseBytes
    )
      throw new JobSearchResponseError();
    const rows = data[route === "skills" ? "skills_list" : "jobs_list"];
    if (!Array.isArray(rows)) throw new JobSearchResponseError();
    const valid =
      route === "skills"
        ? rows.every(skill)
        : rows.every(
            (v) =>
              object(v) &&
              typeof v.title === "string" &&
              typeof v.description === "string" &&
              typeof v.job_site === "string" &&
              typeof v.link_to_job === "string" &&
              Array.isArray(v.skills_matched) &&
              v.skills_matched.every(skill) &&
              number(v.jobs_match_relevance)
          );
    if (!valid) throw new JobSearchResponseError();
    return data;
  } catch {
    throw new JobSearchResponseError();
  }
}
