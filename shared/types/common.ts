export interface McpServerConfig {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
}

export interface ApiCredentials {
  apiKey?: string;
  token?: string;
  username?: string;
  password?: string;
  baseUrl?: string;
}

export type FailureCode =
  | "invalid_input"
  | "authentication"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "timeout"
  | "unavailable"
  | "provider_error"
  | "invalid_response"
  | "internal_error";

export interface ServerFailure {
  success: false;
  error: { code: FailureCode; message: string; retryAfterSeconds?: number };
}

export type ServerResponse<T = unknown> =
  { success: true; data: T } | ServerFailure;

export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SearchOptions extends PaginationOptions {
  query?: string;
  filters?: Record<string, unknown>;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  server: string;
  action: string;
  userId?: string;
  timestamp: string;
}
