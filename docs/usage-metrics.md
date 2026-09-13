# Usage Metrics

Dobby AI reports one anonymous `daily_active` event per installation per UTC day as part of operating the service. The event is sent to the proxy's `/telemetry` endpoint and is recorded in the Worker's structured observability logs; it does not use the rate-limit KV namespace.

## Event fields

```json
{
  "event": "daily_active",
  "schema_version": 1,
  "mode": "free",
  "installation_id": "random-uuid",
  "extension_version": "1.4.5",
  "usage": {
    "free": {
      "chat_requests": 3,
      "autosuggest_requests": 11,
      "successful_requests": 12,
      "provider_errors": 1,
      "timeouts": 0,
      "rate_limited": 1
    },
    "byok": {
      "chat_requests": 5,
      "autosuggest_requests": 20,
      "successful_requests": 22,
      "provider_errors": 2,
      "timeouts": 1,
      "rate_limited": 0
    },
    "screenshot_requests": 2
  }
}
```

`mode` is either `free` or `byok`. The `usage` object contains aggregate counters from local extension state; it has no per-request detail. `schema_version` is `1` for this payload shape. The installation ID is randomly generated and contains no account or API-key information. The mode and counters are client-reported, so they are useful for adoption, capacity, and reliability estimates rather than security or billing decisions.

## Cloudflare Log Explorer

Filter structured logs with:

- `event = "dobby_request"`
- `outcome = "telemetry_recorded"`
- `telemetry_event = "daily_active"`
- `usage_mode = "free"` or `usage_mode = "byok"`

Count distinct `installation_id` values for daily active installation counts. Free proxy request logs are also tagged with `usage_mode = "free"`; successful model requests have `route = "chat"` and `outcome = "stream_started"`.

Use the nested `usage.free` and `usage.byok` counters to estimate request volume and failure mix by credential mode. The aggregate is sent once per UTC day at the first tracked request, so it is a lightweight usage snapshot rather than a per-request event stream.
