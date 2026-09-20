import {
  getEnvVar,
  getIntegerEnvVar,
  getLogLevel,
} from "../../../shared/utils/config.js";
export function readConfig() {
  return {
    apiKey: getEnvVar("AI_GATEWAY_API_KEY"),
    timeoutMs: getIntegerEnvVar("JEV_TIMEOUT_MS", {
      min: 100,
      max: 120000,
      defaultValue: 30000,
    }),
    logLevel: getLogLevel(),
  };
}
