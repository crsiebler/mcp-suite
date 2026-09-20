import axios, { AxiosError, type AxiosAdapter } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DuffelService } from "../../servers/flight/src/services/duffel-service.ts";
import { Logger } from "../../shared/utils/logger.ts";

// Exercise the real service and Axios interceptors without a network transport.
function service(adapter: AxiosAdapter) {
  const client = axios.create({ adapter });
  vi.spyOn(axios, "create").mockReturnValue(client);
  return new DuffelService(
    { apiKey: "synthetic-test-key", environment: "test" },
    new Logger("error")
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Duffel airline mapping (offline)", () => {
  it("sends the limit and unwraps the provider data envelope", async () => {
    const airline = { id: "arl_fixture", name: "Fixture Air", iata_code: "ZZ" };
    let url: string | undefined;
    const client = service(async (config) => {
      url = config.url;
      return {
        data: { data: [airline] },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    });
    expect(await client.getAirlines(2)).toEqual({
      success: true,
      data: [airline],
    });
    expect(url).toBe("/air/airlines?limit=2");
  });

  it("maps a provider failure to the existing failure result", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = service(async (config) => {
      throw new AxiosError(
        "Request failed",
        "ERR_BAD_REQUEST",
        config,
        undefined,
        {
          data: { errors: [{ detail: "Invalid limit" }] },
          status: 422,
          statusText: "Unprocessable Entity",
          headers: {},
          config,
        }
      );
    });
    expect(await client.getAirlines(-1)).toEqual({
      success: false,
      error: "Failed to get airlines: Invalid limit",
    });
  });
});
