# Usage Metrics

Dobby AI reports one anonymous `daily_active` event per installation per UTC day when anonymous usage metrics are enabled in Settings. The event is sent to the proxy's `/telemetry` endpoint and is recorded in the Worker's structured observability logs; it does not use the rate-limit KV namespace.

## Event fields

```json
{
  "event": "dobby_usage",
  "telemetry_event": "daily_active",
  "usage_mode": "free",
  "installation_id": "random-uuid",
  "extension_version": "1.4.5"
}
```

`usage_mode` is either `free` or `byok`. The installation ID is randomly generated and contains no account or API-key information. The mode is client-reported, so it is useful for adoption and capacity estimates rather than security or billing decisions.

## Cloudflare Log Explorer

Filter structured logs with:

- `event = "dobby_request"`
- `outcome = "telemetry_recorded"`
- `telemetry_event = "daily_active"`
- `usage_mode = "free"` or `usage_mode = "byok"`

Count distinct `installation_id` values for daily active installation counts. Free proxy request logs are also tagged with `usage_mode = "free"`; successful model requests have `route = "chat"` and `outcome = "stream_started"`.
