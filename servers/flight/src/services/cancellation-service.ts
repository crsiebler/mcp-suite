import { AxiosError, type AxiosInstance } from "axios";
import type { ServerResponse } from "../../../../shared/types/common.js";
import {
  failure,
  InputError,
  normalizeFailure,
} from "../../../../shared/utils/errors.js";

export interface CancellationQuote {
  id: string;
  order_id: string;
  refund_amount: string | null;
  refund_currency: string | null;
  refund_to: string;
  airline_credits?: unknown[];
  live_mode: boolean;
  created_at: string;
  expires_at: string | null;
  confirmed_at: string | null;
}

function identifier(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_]{1,128}$/.test(value))
    throw new InputError(field);
  return value;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function timestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(
      value
    )
  )
    return false;
  const day = Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
  return (
    Number.isFinite(Date.parse(value)) &&
    Number.isFinite(day) &&
    new Date(day).toISOString().slice(0, 10) === value.slice(0, 10)
  );
}
function cancellationFailure(error: unknown) {
  // This module owns the only cancellation signal; its deadline caused the abort.
  return error instanceof AxiosError && error.code === "ERR_CANCELED"
    ? failure("timeout")
    : normalizeFailure(error);
}
function parseQuote(body: unknown): CancellationQuote | undefined {
  if (!object(body) || !object(body.data)) return undefined;
  const q = body.data;
  if (
    typeof q.id !== "string" ||
    !/^[A-Za-z0-9_]{1,128}$/.test(q.id) ||
    typeof q.order_id !== "string" ||
    !/^[A-Za-z0-9_]{1,128}$/.test(q.order_id) ||
    !(
      q.refund_amount === null ||
      (typeof q.refund_amount === "string" &&
        /^\d{1,16}(\.\d{1,6})?$/.test(q.refund_amount))
    ) ||
    !(
      q.refund_currency === null ||
      (typeof q.refund_currency === "string" &&
        /^[A-Z]{3}$/.test(q.refund_currency))
    ) ||
    ![
      "arc_bsp_cash",
      "balance",
      "card",
      "voucher",
      "awaiting_payment",
      "airline_credits",
      "original_form_of_payment",
    ].includes(q.refund_to as string) ||
    typeof q.live_mode !== "boolean" ||
    !timestamp(q.created_at) ||
    !(q.expires_at === null || timestamp(q.expires_at)) ||
    !(q.confirmed_at === null || timestamp(q.confirmed_at)) ||
    (q.airline_credits !== undefined &&
      (!Array.isArray(q.airline_credits) || !q.airline_credits.every(object)))
  )
    return undefined;
  return {
    id: q.id,
    order_id: q.order_id,
    refund_amount: q.refund_amount,
    refund_currency: q.refund_currency,
    refund_to: q.refund_to as string,
    live_mode: q.live_mode,
    created_at: q.created_at,
    expires_at: q.expires_at,
    confirmed_at: q.confirmed_at,
    ...(q.airline_credits === undefined
      ? {}
      : { airline_credits: q.airline_credits as unknown[] }),
  };
}
function requestOptions() {
  return {
    timeout: 30000,
    signal: AbortSignal.timeout(30000),
    maxContentLength: 1048576,
    maxRedirects: 0,
  };
}

/** Uses the existing authenticated client; does not grant host confirmation. */
export class CancellationService {
  constructor(private readonly client: AxiosInstance) {}

  async quote(orderId: unknown): Promise<ServerResponse<CancellationQuote>> {
    try {
      const id = identifier(orderId, "order_id");
      const response = await this.client.post<unknown>(
        "/air/order_cancellations",
        { data: { order_id: id } },
        requestOptions()
      );
      const quote = parseQuote(response.data);
      if (!quote || quote.order_id !== id || quote.confirmed_at !== null)
        return failure("invalid_response");
      return { success: true, data: quote };
    } catch (error) {
      return cancellationFailure(error);
    }
  }

  async confirm(
    orderId: unknown,
    cancellationId: unknown
  ): Promise<ServerResponse<CancellationQuote>> {
    let submitted = false;
    try {
      const order = identifier(orderId, "order_id");
      const id = identifier(cancellationId, "cancellation_id");
      const path = `/air/order_cancellations/${id}`;
      const response = await this.client.get<unknown>(path, requestOptions());
      const quote = parseQuote(response.data);
      if (!quote || quote.id !== id || quote.order_id !== order)
        return failure("invalid_response");
      if (quote.confirmed_at !== null) return { success: true, data: quote };
      if (
        quote.expires_at !== null &&
        Date.parse(quote.expires_at) <= Date.now()
      ) {
        const result = failure("invalid_input");
        result.error.message =
          "Cancellation quote expired. Obtain and review a new quote before confirming.";
        return result;
      }
      submitted = true;
      const confirmed = await this.client.post<unknown>(
        `${path}/actions/confirm`,
        undefined,
        requestOptions()
      );
      const result = parseQuote(confirmed.data);
      if (
        !result ||
        result.id !== id ||
        result.order_id !== order ||
        result.confirmed_at === null
      ) {
        const failureResult = failure("invalid_response");
        failureResult.error.message =
          "Confirmation response was invalid; the cancellation outcome is unknown. Verify the order before taking further action.";
        return failureResult;
      }
      return { success: true, data: result };
    } catch (error) {
      const result = cancellationFailure(error);
      if (submitted)
        result.error.message +=
          " Cancellation may have occurred. Verify the order before taking further action; do not automatically retry.";
      return result;
    }
  }
}
