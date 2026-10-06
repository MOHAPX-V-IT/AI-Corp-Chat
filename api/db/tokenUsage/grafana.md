# Grafana — token_usage telemetry

The app writes one row per LLM call into Postgres `token_usage` (same structure as
Sales Gyroscope). Point a Grafana **PostgreSQL** datasource at the DB
(`TOKEN_USAGE_DB_URL`) and use the panels below. `cost_*` are stored as strings —
always cast `::numeric` for math.

## Template variables
- **client** (multi): `SELECT DISTINCT domain FROM token_usage ORDER BY 1`
- **provider** (multi): `SELECT DISTINCT provider FROM token_usage ORDER BY 1`

## Panels

**Spend, USD over time** (timeseries)
```sql
SELECT
  $__timeGroup(created_at, '1d') AS time,
  sum(cost_input::numeric + cost_output::numeric) AS "USD"
FROM token_usage
WHERE $__timeFilter(created_at)
  AND domain   IN ($client)
  AND provider IN ($provider)
GROUP BY 1 ORDER BY 1;
```

**Spend by model** (bar/table)
```sql
SELECT model,
  sum(cost_input::numeric + cost_output::numeric) AS "USD",
  sum(input_tokens)  AS in_tokens,
  sum(output_tokens) AS out_tokens,
  count(*)           AS calls
FROM token_usage
WHERE $__timeFilter(created_at) AND domain IN ($client) AND provider IN ($provider)
GROUP BY model ORDER BY "USD" DESC;
```

**Spend by purpose** (piechart)
```sql
SELECT purpose, sum(cost_input::numeric + cost_output::numeric) AS "USD"
FROM token_usage
WHERE $__timeFilter(created_at) AND domain IN ($client) AND provider IN ($provider)
GROUP BY purpose ORDER BY "USD" DESC;
```

**Spend by client/domain** (bar)
```sql
SELECT domain, sum(cost_input::numeric + cost_output::numeric) AS "USD"
FROM token_usage
WHERE $__timeFilter(created_at) AND provider IN ($provider)
GROUP BY domain ORDER BY "USD" DESC;
```

## Notes
- `domain` for this product is `TOKEN_USAGE_DOMAIN` (default `corp-ai-chat`) — it
  appears as a `client` value alongside the Sales Gyroscope Bitrix24 portals.
- `purpose` values here: `chat`, `ipr`, `transcript`, `title`.
- To feed the shared prod Grafana (gyro.nda.dj), write to the same Postgres that
  dashboard reads, i.e. set `TOKEN_USAGE_DB_URL` in prod to that database.
- Unknown model → `cost_*` NULL (add the model to the `tariffs` sheet / `tariffs.js`).
