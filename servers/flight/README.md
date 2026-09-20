# Flight MCP Server

A Model Context Protocol (MCP) server that integrates with the [Duffel API](https://duffel.com/) to provide comprehensive flight booking and management capabilities.

## Features

### Core Flight Operations

- **Flight Search**: Search for flights between airports with various filters
- **Offer Management**: Get and manage flight offers from search results
- **Booking Management**: Create, retrieve, and cancel flight bookings
- **Seat Maps**: Access seat maps for specific flight offers

### Reference Data

- **Airlines**: Get information about airlines
- **Airports**: Search and get airport information by IATA code

### Available Tools

1. **duffel_test_connection** - Test connection to Duffel API
2. **duffel_search_flights** - Search for flights between airports
3. **duffel_get_offer_request** - Get details of a specific offer request
4. **duffel_get_offers** - Get available offers for an offer request
5. **duffel_get_offer** - Get details of a specific offer
6. **duffel_create_order** - Create a booking order from selected offers
7. **duffel_get_order** - Get details of a specific order
8. **duffel_list_orders** - List all orders with pagination
9. **duffel_quote_order_cancellation** - Create a pending cancellation quote
10. **duffel_confirm_order_cancellation** - Confirm an explicitly approved quote
11. **duffel_get_seat_maps** - Get seat maps for a specific offer
12. **duffel_get_airlines** - Get list of airlines
13. **duffel_get_airports** - Get list of airports

## Configuration

### Environment Variables

- `DUFFEL_API_KEY` (required): Your Duffel API key
- `DUFFEL_ENVIRONMENT` (optional): Exactly 'test' or 'live' (defaults to 'test' only when unset; blank/unknown values fail)

### Getting a Duffel API Key

1. Sign up at [Duffel](https://duffel.com/)
2. Create a new API key in your dashboard
3. Use the test key for development and the live key for production

## Usage

### Basic Flight Search

```json
{
  "name": "duffel_search_flights",
  "arguments": {
    "origin": "JFK",
    "destination": "LAX",
    "departure_date": "2024-12-15",
    "passengers": {
      "adults": 1
    },
    "cabin_class": "economy"
  }
}
```

### Round-trip Search

```json
{
  "name": "duffel_search_flights",
  "arguments": {
    "origin": "JFK",
    "destination": "LAX",
    "departure_date": "2024-12-15",
    "return_date": "2024-12-22",
    "passengers": {
      "adults": 2,
      "children": 1
    },
    "cabin_class": "business"
  }
}
```

### Get Available Offers

```json
{
  "name": "duffel_get_offers",
  "arguments": {
    "offer_request_id": "orq_12345",
    "limit": 10
  }
}
```

### Create a Booking

```json
{
  "name": "duffel_create_order",
  "arguments": {
    "selected_offers": ["off_12345"],
    "passengers": [
      {
        "id": "pas_12345",
        "type": "adult",
        "given_name": "John",
        "family_name": "Doe",
        "gender": "M",
        "born_on": "1990-01-01",
        "email": "john@example.com",
        "phone_number": "+1234567890"
      }
    ],
    "type": "hold"
  }
}
```

## Development

### Building

```bash
# Build the flight server
npm run build -- --server=flight

# Build all servers
npm run build
```

### Testing

```bash
# Offline fixture tests (no credentials or provider access)
npm test
npm test -- tests/unit/duffel-cancellation.test.ts

# Live checks are separate, explicitly authorized and opt-in;
# see ../../docs/testing.md before running npm run test:live.
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## API Reference

The server exposes the operations listed above, not the full Duffel API. Key concepts:

- **Offer Request**: A search query that generates multiple flight offers
- **Offer**: A specific flight option with pricing and availability
- **Order**: A confirmed booking with passenger details
- **Slice**: A one-way journey (outbound or return)
- **Segment**: A single flight leg within a slice

## Error Handling

The server provides comprehensive error handling for:

- Invalid API credentials
- Malformed requests
- Network connectivity issues
- Duffel API rate limits
- Booking validation errors

The two cancellation tools use the shared safe JSON envelope described below.
Other tools retain their existing response formats; they have not all migrated.

## Cancellation workflow and migration

`duffel_cancel_order` has been removed. Replace it with two distinct calls:

1. Call `duffel_quote_order_cancellation` with `order_id`. This creates a pending
   provider resource; it does not cancel the booking.
2. Show the returned quote ID, order ID, refund amount/currency, destination,
   airline credits and expiry to the user. Obtain explicit approval for this
   specific cancellation through the host before proceeding.
3. Call `duffel_confirm_order_cancellation` with that `order_id` and
   `cancellation_id`. It retrieves the quote, verifies both identities and expiry,
   then confirms that exact ID. An already-confirmed quote returns its current
   details without another confirmation POST.

The host must retain confirmation for the destructive confirmation tool. No
boolean argument or MCP annotation constitutes approval. Quote creation is also
an external write: it can supersede a prior quote. Both tools advertise
`readOnlyHint: false` and `idempotentHint: false`; confirmation additionally has
`destructiveHint: true`. These hints describe behavior, not access control. This
change does not modify account authentication or global client approval settings.

Duffel documents separate pending-quote and confirmation endpoints and permits
confirmation only of the latest quote for an order. The provider remains
responsible for enforcing that condition, including races with other clients.
An expired or rejected quote requires a newly reviewed quote; the server never
silently creates a replacement while confirming. [Duffel order cancellations](https://duffel.com/docs/api/order-cancellations)

Refund values are preserved as decimal strings or null. Null means unknown,
not zero. Expiry can also be null; in that case the provider decides validity.
Airline-credit objects are retained when supplied, but their nested fields are
not independently validated by this integration. Show them to the user and
follow the provider's terms. A mixed cash/credit refund amount can include both
components; cancellation is not proof of a cash refund to the passenger's card.
Customer refunds may require a separate merchant action. [Duffel refund schema](https://duffel.com/docs/api/order-cancellations/schema)

These two tools return JSON in MCP text content:

- Success: `{ "success": true, "data": { ...quote } }`.
- Failure: `{ "success": false, "error": { "code": "...", "message": "..." } }`
  with `isError: true`, optionally including bounded retry timing metadata.

Quote data contains `id`, `order_id`, `refund_amount`, `refund_currency`,
`refund_to`, `live_mode`, `created_at`, `expires_at`, `confirmed_at`, and optional
`airline_credits`. Invalid/mismatched responses are failures, not cancellation
successes. Identifiers accept 1–128 ASCII letters, digits or underscores; no path
segments or query strings are accepted as IDs.

Each cancellation HTTP request has a 30-second timeout/abort deadline, a 1 MiB
response limit, and no redirects. Confirmation can make two requests. There are
no automatic retries. A timeout, disconnected response or malformed confirmation
response can leave the cancellation outcome unknown. Inspect the order through
`duffel_get_order` or the provider before taking further action; do not repeat the
confirmation or initiate a passenger refund merely because a call failed.

`DUFFEL_ENVIRONMENT` retains its existing parsing; the token determines whether
Duffel operates in test or live mode. No live compatibility, refund settlement or
host approval enforcement was established by offline tests. Source changes need
a release before becoming available from npm.

## License

MIT
