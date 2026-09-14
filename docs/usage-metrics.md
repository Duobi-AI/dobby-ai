# Usage Metrics

Dobby AI sends one anonymous `usage_request` event for every tracked request. The event is sent to the proxy's `/telemetry` endpoint and recorded in the Worker's structured observability logs; it does not use the rate-limit KV namespace.

## Event fields

```json
{
  "event": "usage_request",
  "schema_version": 2,
  "mode": "free",
  "installation_id": "random-uuid",
  "extension_version": "1.4.6",
  "request_kind": "chat",
  "outcome": "success"
}
```

`mode` is either `free` or `byok`. `request_kind` is `chat`, `autosuggest`, or `screenshot`; `outcome` is `success`, `provider_error`, `timeout`, or `rate_limited`. Screenshot events are emitted after a successful capture. The installation ID is randomly generated and contains no account or API-key information. The fields are client-reported, so they are suitable for adoption, capacity, and reliability estimates rather than security or billing decisions.

The Worker continues to accept the v1 daily event from extensions that have not yet upgraded, but central per-request reporting must filter for `schema_version = 2`.

## Cloudflare Log Explorer

Filter structured logs with:

- `event = "dobby_request"`
- `outcome = "telemetry_recorded"`
- `telemetry_event = "usage_request"`
- `telemetry_schema_version = 2`
- `usage_mode = "free"` or `usage_mode = "byok"`

Count events, grouped by `usage_mode`, `telemetry_request_kind`, and `telemetry_outcome`, for central request volume and reliability metrics. Count distinct `installation_id` values only when measuring installations, not requests.
