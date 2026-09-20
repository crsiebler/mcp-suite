import { type AxiosInstance } from "axios";
import { InputError } from "../../../../shared/utils/errors.js";

export interface CoursePaginationOptions {
  include_pagination?: boolean;
  per_page?: number;
  page_url?: string;
}
export interface CoursePage<T> {
  items: T[];
  next_page_url: string | null;
}
export class CanvasPageResponseError extends Error {
  constructor() {
    super("Invalid Canvas pagination response");
  }
}

function continuation(client: AxiosInstance, value: unknown): string {
  try {
    if (
      typeof value !== "string" ||
      value.length > 8192 ||
      /[\s\\#]/.test(value)
    )
      throw new Error();
    const expected = new URL(
      `${client.defaults.baseURL?.replace(/\/$/, "")}/courses`
    );
    const url = new URL(value);
    if (
      url.origin !== expected.origin ||
      url.pathname !== expected.pathname ||
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      [...url.searchParams.keys()].some(
        (key) => key.toLowerCase() === "access_token"
      )
    )
      throw new Error();
    return value; // Keep opaque query spelling; never rebuild the provider cursor.
  } catch {
    throw new InputError("page_url");
  }
}

function nextLink(header: unknown): string | undefined {
  if (header === undefined || header === null || header === "")
    return undefined;
  if (typeof header !== "string" || header.length > 65536)
    throw new CanvasPageResponseError();
  const parts: string[] = [];
  let start = 0,
    angle = false,
    quoted = false;
  for (let i = 0; i < header.length; i++) {
    const char = header[i];
    if (char === '"' && !angle && header[i - 1] !== "\\") quoted = !quoted;
    if (!quoted && char === "<") angle = true;
    if (!quoted && char === ">") angle = false;
    if (char === "," && !angle && !quoted) {
      parts.push(header.slice(start, i));
      start = i + 1;
    }
  }
  if (angle || quoted) throw new CanvasPageResponseError();
  parts.push(header.slice(start));
  let next: string | undefined;
  for (const part of parts) {
    const match = part.match(/^\s*<([^<>]+)>\s*(.*)$/);
    if (!match) throw new CanvasPageResponseError();
    const attributes = [
      ...match[2].matchAll(
        /(?:^|;)\s*([^\s=;]+)\s*=\s*(?:"((?:\\.|[^"])*)"|([^;\s]+))/g
      ),
    ];
    const relation = attributes.find(
      (attribute) => attribute[1].toLowerCase() === "rel"
    );
    if ((relation?.[2] ?? relation?.[3] ?? "").split(/\s+/).includes("next")) {
      if (next !== undefined) throw new CanvasPageResponseError();
      next = match[1];
    }
  }
  return next;
}

/** One request per call; opt-in metadata preserves the legacy array contract. */
export async function readCoursePage<T>(
  client: AxiosInstance,
  query: Record<string, unknown>,
  options: CoursePaginationOptions
): Promise<T[] | CoursePage<T>> {
  if (
    options.include_pagination !== undefined &&
    typeof options.include_pagination !== "boolean"
  )
    throw new InputError("include_pagination");
  if (
    options.per_page !== undefined &&
    (!Number.isInteger(options.per_page) ||
      options.per_page < 1 ||
      options.per_page > 100)
  )
    throw new InputError("per_page");
  if (
    options.page_url !== undefined &&
    (options.include_pagination !== true ||
      options.per_page !== undefined ||
      Object.keys(query).length > 0)
  )
    throw new InputError("page_url");
  const url =
    options.page_url === undefined
      ? "/courses"
      : continuation(client, options.page_url);
  const params =
    options.page_url === undefined
      ? {
          ...query,
          ...(options.per_page === undefined
            ? {}
            : { per_page: options.per_page }),
        }
      : undefined;
  const response = await client.get(url, {
    params,
    ...(options.include_pagination ? { maxRedirects: 0 } : {}),
  });
  if (!options.include_pagination) return response.data;
  if (!Array.isArray(response.data)) throw new CanvasPageResponseError();
  try {
    const linkKey = Object.keys(response.headers).find(
      (key) => key.toLowerCase() === "link"
    );
    const next = nextLink(
      linkKey === undefined ? undefined : response.headers[linkKey]
    );
    return {
      items: response.data,
      next_page_url: next === undefined ? null : continuation(client, next),
    };
  } catch {
    throw new CanvasPageResponseError();
  }
}
