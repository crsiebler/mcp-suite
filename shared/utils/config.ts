import { LogLevel } from "../types/common.js";

export class ConfigurationError extends Error {
  constructor(key: string) {
    super(`Invalid environment variable ${key}`);
    this.name = "ConfigurationError";
  }
}

function invalid(key: string): never {
  throw new ConfigurationError(key);
}

export function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  // Check emptiness without modifying credentials or operation-specific text.
  return value;
}

export function getOptionalEnvVar(key: string, defaultValue = ""): string {
  return process.env[key] ?? defaultValue;
}

export function getBooleanEnvVar(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  if (value === "true") return true;
  if (value === "false") return false;
  return invalid(key);
}

export function getIntegerEnvVar(
  key: string,
  options: { min: number; max: number; defaultValue?: number }
): number {
  const { min, max, defaultValue } = options;
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
    return invalid(key);
  }
  const text = process.env[key];
  if (text !== undefined && !/^-?\d+$/.test(text)) return invalid(key);
  const value = text === undefined ? defaultValue : Number(text);
  if (
    value === undefined ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    return invalid(key);
  }
  return value;
}

export function getEnumEnvVar<T extends string>(
  key: string,
  allowed: readonly T[],
  defaultValue: T
): T {
  const value = process.env[key] ?? defaultValue;
  if (!allowed.includes(value as T)) return invalid(key);
  return value as T;
}

/** Base HTTP endpoints: keep caller-selected hosts and exact valid path bytes. */
export function getHttpUrlEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (!value || value.trim() !== value || /[\s\\?#]/.test(value))
    return invalid(key);
  try {
    const url = new URL(value);
    if (
      !/^https?:\/\//i.test(value) ||
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return invalid(key);
    }
  } catch {
    return invalid(key);
  }
  return value;
}

export function getLogLevel(): LogLevel {
  const value = process.env.LOG_LEVEL;
  if (value === undefined) return "info";
  const normalized = value.toLowerCase();
  if (!["debug", "info", "warn", "error"].includes(normalized))
    return invalid("LOG_LEVEL");
  return normalized as LogLevel;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}
