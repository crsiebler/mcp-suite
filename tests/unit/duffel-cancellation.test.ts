import axios, { AxiosError, type AxiosAdapter } from "axios";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DuffelService } from "../../servers/flight/src/services/duffel-service.ts";
import { Logger } from "../../shared/utils/logger.ts";

const quote = {
  id: "ore_fixture",
  order_id: "ord_fixture",
  refund_amount: "90.80",
  refund_currency: "GBP",
  refund_to: "balance",
  airline_credits: [],
  live_mode: false,
  created_at: "2026-09-20T10:00:00Z",
  expires_at: "2026-09-20T11:00:00Z",
  confirmed_at: null,
};
function service(adapter: AxiosAdapter) {
  const client = axios.create({ adapter });
  vi.spyOn(axios, "create").mockReturnValue(client);
  return new DuffelService(
    { apiKey: "synthetic-test-key", environment: "test" },
    new Logger("error")
  );
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-20T10:30:00Z"));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("creates a pending quote without confirming or claiming cancellation", async () => {
  const requests: { method?: string; url?: string; data: unknown }[] = [];
  const api = service(async (config) => {
    requests.push({
      method: config.method,
      url: config.url,
      data: JSON.parse(config.data),
    });
    return {
      data: { data: quote },
      status: 201,
      statusText: "Created",
      headers: {},
      config,
    };
  });
  expect(await api.quoteOrderCancellation("ord_fixture")).toEqual({
    success: true,
    data: quote,
  });
  expect(requests).toEqual([
    {
      method: "post",
      url: "/air/order_cancellations",
      data: { data: { order_id: "ord_fixture" } },
    },
  ]);
});

it("retrieves the chosen quote and confirms that exact ID only", async () => {
  const requests: string[] = [];
  const confirmed = { ...quote, confirmed_at: "2026-09-20T10:30:01Z" };
  const api = service(async (config) => {
    requests.push(`${config.method} ${config.url}`);
    expect(config.timeout).toBe(30000);
    return {
      data: { data: config.method === "get" ? quote : confirmed },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  });
  expect(
    await api.confirmOrderCancellation("ord_fixture", "ore_fixture")
  ).toEqual({ success: true, data: confirmed });
  expect(requests).toEqual([
    "get /air/order_cancellations/ore_fixture",
    "post /air/order_cancellations/ore_fixture/actions/confirm",
  ]);
});

it.each([
  { ...quote, order_id: "ord_other" },
  { ...quote, id: "ore_other" },
  { ...quote, expires_at: "2026-09-20T10:29:59Z" },
  { ...quote, expires_at: "not-a-date" },
])(
  "does not confirm a mismatched, expired or malformed quote",
  async (data) => {
    const requests: string[] = [];
    const api = service(async (config) => {
      requests.push(config.method!);
      return {
        data: { data },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    });
    expect(
      (await api.confirmOrderCancellation("ord_fixture", "ore_fixture")).success
    ).toBe(false);
    expect(requests).toEqual(["get"]);
  }
);

it("preserves unknown refunds and expiry instead of converting them to zero", async () => {
  const data = {
    ...quote,
    refund_amount: null,
    refund_currency: null,
    expires_at: null,
  };
  const api = service(async (config) => ({
    data: { data },
    status: 201,
    statusText: "Created",
    headers: {},
    config,
  }));
  expect(await api.quoteOrderCancellation("ord_fixture")).toEqual({
    success: true,
    data,
  });
});

it("reports an already confirmed quote without another POST", async () => {
  const data = { ...quote, confirmed_at: "2026-09-20T10:15:00Z" };
  const methods: string[] = [];
  const api = service(async (config) => {
    methods.push(config.method!);
    return {
      data: { data },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  });
  expect(
    await api.confirmOrderCancellation("ord_fixture", "ore_fixture")
  ).toEqual({ success: true, data });
  expect(methods).toEqual(["get"]);
});

it.each(["../private", "", "ore_fixture?private", "ore_fixture/private"])(
  "rejects invalid cancellation IDs before requests",
  async (id) => {
    const adapter = vi.fn();
    expect(
      (await service(adapter).confirmOrderCancellation("ord_fixture", id))
        .success
    ).toBe(false);
    expect(adapter).not.toHaveBeenCalled();
  }
);

it.each([422, 409])(
  "returns a safe provider failure for a non-cancellable order or stale quote (%s)",
  async (status) => {
    let calls = 0;
    const api = service(async (config) => {
      calls++;
      throw new AxiosError(
        "private-provider-message",
        "ERR_BAD_REQUEST",
        config,
        undefined,
        {
          data: {
            errors: [
              { code: "order_not_cancellable", detail: "private-booking" },
            ],
          },
          status,
          statusText: "Failure",
          headers: {},
          config,
        }
      );
    });
    const result = await api.quoteOrderCancellation("ord_fixture");
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain("private-");
    expect(calls).toBe(1);
  }
);

it("does not retry a timed-out confirmation and reports an uncertain outcome", async () => {
  const methods: string[] = [];
  const api = service(async (config) => {
    methods.push(config.method!);
    if (config.method === "post")
      throw new AxiosError("private-timeout", "ECONNABORTED", config);
    return {
      data: { data: quote },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  });
  const result = await api.confirmOrderCancellation(
    "ord_fixture",
    "ore_fixture"
  );
  expect(result).toMatchObject({ success: false, error: { code: "timeout" } });
  expect(JSON.stringify(result)).toMatch(/unknown|uncertain/i);
  expect(JSON.stringify(result)).not.toContain("private-");
  expect(methods).toEqual(["get", "post"]);
});

it("treats an AbortSignal deadline cancellation as a timeout", async () => {
  const api = service(async (config) => {
    throw new AxiosError("private-abort", "ERR_CANCELED", config);
  });
  expect(await api.quoteOrderCancellation("ord_fixture")).toMatchObject({
    success: false,
    error: { code: "timeout" },
  });
});

it("accepts ISO 8601 timestamp offsets", async () => {
  const data = {
    ...quote,
    created_at: "2026-09-20T11:00:00+01:00",
    expires_at: "2026-09-20T12:00:00+01:00",
  };
  const api = service(async (config) => ({
    data: { data },
    status: 201,
    statusText: "Created",
    headers: {},
    config,
  }));
  expect(await api.quoteOrderCancellation("ord_fixture")).toEqual({
    success: true,
    data,
  });
});

it("does not retry a provider rejection of a superseded quote at confirmation", async () => {
  const methods: string[] = [];
  const api = service(async (config) => {
    methods.push(config.method!);
    if (config.method === "post")
      throw new AxiosError(
        "private-stale",
        "ERR_BAD_REQUEST",
        config,
        undefined,
        {
          data: { errors: [{ detail: "private-stale" }] },
          status: 409,
          statusText: "Conflict",
          headers: {},
          config,
        }
      );
    return {
      data: { data: quote },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  });
  const result = await api.confirmOrderCancellation(
    "ord_fixture",
    "ore_fixture"
  );
  expect(result).toMatchObject({
    success: false,
    error: { code: "provider_error" },
  });
  expect(JSON.stringify(result)).not.toContain("private-");
  expect(methods).toEqual(["get", "post"]);
});

it.each([
  { ...quote, confirmed_at: null },
  { ...quote, id: "ore_wrong", confirmed_at: "2026-09-20T10:30:01Z" },
  { ...quote, refund_amount: -1, confirmed_at: "2026-09-20T10:30:01Z" },
])(
  "does not claim successful cancellation from an invalid confirmation response",
  async (data) => {
    const api = service(async (config) => ({
      data: { data: config.method === "get" ? quote : data },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    }));
    const result = await api.confirmOrderCancellation(
      "ord_fixture",
      "ore_fixture"
    );
    expect(result).toMatchObject({
      success: false,
      error: { code: "invalid_response" },
    });
    expect(JSON.stringify(result)).toContain("unknown");
  }
);
