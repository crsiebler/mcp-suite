import { LogLevel, LogContext } from "../types/common.js";
import { safeLogData, safeLogError, safeText } from "./log-data.js";

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  constructor(
    private level: LogLevel = "info",
    private context: Partial<LogContext> = {}
  ) {}

  private write(level: LogLevel, message: string, data?: unknown): void {
    if (levels[level] < levels[this.level]) return;
    // A diagnostic failure must not replace the original operation's outcome.
    try {
      const record = {
        timestamp: new Date().toISOString(),
        level,
        context: safeLogData(this.context),
        message: safeText(message),
        ...(data === undefined ? {} : { details: safeLogData(data) }),
      };
      let line = JSON.stringify(record);
      if (Buffer.byteLength(line, "utf8") > 8191) {
        line = JSON.stringify({ ...record, details: "[Truncated]" });
      }
      if (Buffer.byteLength(line, "utf8") > 8191) {
        line = JSON.stringify({
          ...record,
          context: "[Truncated]",
          details: "[Truncated]",
        });
      }
      console.error(line);
    } catch {
      // Never fall back to stdout or serialize the failure itself.
    }
  }

  debug(message: string, data?: unknown): void {
    this.write("debug", message, data);
  }
  info(message: string, data?: unknown): void {
    this.write("info", message, data);
  }
  warn(message: string, data?: unknown): void {
    this.write("warn", message, data);
  }
  error(message: string, error?: unknown): void {
    this.write(
      "error",
      message,
      error === undefined ? undefined : safeLogError(error)
    );
  }

  withContext(context: Partial<LogContext>): Logger {
    return new Logger(this.level, { ...this.context, ...context });
  }
}
