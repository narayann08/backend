# FluxCast API Contract

Single source of truth for every endpoint the frontend calls. Verified live
against the seeded MongoDB Atlas cluster on 2026-09-12.

- **Base URL:** `http://localhost:5000/v1` (set via `VITE_API_BASE_URL`)
- **Spec:** `fluxcast-backend/openapi.yaml` — every request is validated against
  it before reaching a handler, so an undocumented path returns `404`.
- **Auth:** no tokens. Login is a one-click role selection; clients may send an
  optional `x-user-role` header afterwards so role-gated routes work. See
  [Authentication](#authentication).
- **Errors:** non-2xx responses are `{ "error": true, "message": string }`,
  sometimes with a `detail` field.

---

## Requirements → endpoint matrix

All 13 frontend data needs are covered.

| #  | Frontend need                                             | Status | Endpoint |
| -- | --------------------------------------------------------- | ------ | -------- |
| 1  | Role-based login; returns role + session                  | EXISTS | `GET /auth/roles`, `POST /auth/login/{role}` |
| 2  | List plants scoped to the current user                    | EXISTS | `GET /plants` |
| 3  | Live weather by plant location                            | EXISTS | `GET /plants/{plantId}/weather` |
| 4  | Real-time power generation per plant                      | EXISTS | `GET /plants/{plantId}/generation/live` |
| 5  | Next-24hr generation forecast                             | EXISTS | `GET /plants/{plantId}/forecast?horizon=24` |
| 6  | Underperformance reason/classification                    | EXISTS | `GET /plants/{plantId}/performance` |
| 7  | Alerts list with priority filter                          | EXISTS | `GET /alerts?severity=` |
| 8  | Cron AI prediction + classification (lower/higher/usual)  | EXISTS | `GET /plants/{plantId}/performance` |
| 9  | Notification/email trigger on high alert / sensor failure | EXISTS | `GET /notifications` (dispatch is backend-only) |
| 10 | Historical forecast vs. actual generation (date-range)    | EXISTS | `GET /plants/{plantId}/history?from=&to=` |
| 11 | Prediction confidence over time                           | EXISTS | `GET /plants/{plantId}/history` → `points[].confidencePct` |
| 12 | AI recommendations / notice board                         | EXISTS | `GET /plants/{plantId}/recommendations` |
| 13 | AI chatbot scoped to selected plant                       | EXISTS | `POST /plants/{plantId}/chat` |

**Added during Phase 0** (needs 4, 6, 8, 9, 10, 11, 12, 13):
`/generation/live`, `/performance`, `/history`, `/recommendations`, `/chat`,
`/notifications`. `GET /plants/{plantId}/weather` was reworked to serve a cached
snapshot so it is safe to poll.

---

## Authentication

There are no passwords, tokens, or sessions. Three predefined users live in the
`users` collection; login fetches one of them by role.

### `GET /auth/roles`

Renders the startup role-selection screen.

```json
{
  "roles": [
    { "key": "system-admin",       "role": "admin",         "label": "System Admin" },
    { "key": "lead-grid-operator", "role": "grid_operator", "label": "Lead Grid Operator" },
    { "key": "utility-admin",      "role": "utility_admin", "label": "Utility Admin" }
  ]
}
```

### `POST /auth/login/{roleKey}`

One endpoint per role: `system-admin`, `lead-grid-operator`, `utility-admin`.
No request body, no credentials.

```json
{
  "user": {
    "id": "6aa532d676c07e2fc075d65e",
    "name": "System Admin",
    "email": "admin@fluxcast.io",
    "role": "admin"
  }
}
```

`404` if no user with that role is stored (run `npm run seed`).

### Sending the role on later requests

After login the client stores `user.role` and sends it as `x-user-role` on
subsequent requests. It is **not** verified — there is no token to verify — and
only one route uses it: `DELETE /plants/{plantId}` requires `admin` or
`utility_admin` and returns `403` otherwise. Every other route ignores it.

---

## Plants

### `GET /plants`

Query: `type` (`solar|wind`), `page` (default 1), `limit` (default 20).

```json
{
  "total": 3,
  "plants": [
    {
      "id": "6aa532d776c07e2fc075d668",
      "name": "Bhadla Solar Park - Block 1",
      "type": "solar",
      "latitude": 27.53,
      "longitude": 71.91,
      "capacityMW": 500,
      "commissionedDate": "2020-03-01T00:00:00.000Z",
      "solarSpec": { "panelTiltDeg": 28, "panelAzimuthDeg": 180 },
      "hasLimitedHistory": false
    }
  ]
}
```

Wind plants carry `windSpec: { hubHeightM, rotorDiameterM }` instead of
`solarSpec`. Documents also include Mongo's `_id`, `__v`, `createdAt`,
`updatedAt`; prefer `id`.

### `GET /plants/{plantId}`

A single plant, same shape as above. `404` if unknown.

### `GET /plants/{plantId}/telemetry`

Query: `days` (default 4). Raw SCADA readings, oldest first.

```json
[
  { "timestamp": "2026-09-12T14:00:00.000Z", "generationMW": 364.6, "sensorStatus": "ok", "outage": false }
]
```

`sensorStatus` is one of `ok | degraded | offline`.

Also available: `POST /plants` (201), `PATCH /plants/{plantId}`,
`POST /plants/{plantId}/telemetry` (201), `DELETE /plants/{plantId}` (204,
role-gated). The frontend does not currently use these.

---

## Weather

### `GET /plants/{plantId}/weather`

Query: `hours` (default 72, max 72), `refresh` (`true` forces a live agent run).

Serves the most recent stored snapshot while it is younger than
`WEATHER_CACHE_MINUTES` (default 60). Only then does it re-run the
Weather-Reasoning Agent, which calls two external APIs plus an LLM — this is
what makes the endpoint safe to poll.

```json
{
  "plantId": "6aa532d776c07e2fc075d668",
  "latitude": 27.53,
  "longitude": 71.91,
  "source": "open-meteo (reconciled)",
  "generatedAt": "2026-09-12T14:10:00.000Z",
  "cached": true,
  "ageMinutes": 22,
  "condition": "clear",
  "conditionLabel": "Clear",
  "current": {
    "time": "2026-09-12T14:30:00.000Z",
    "cloudCoverPct": 9,
    "ghiWm2": 0,
    "dniWm2": 0,
    "rainProbabilityPct": 6,
    "temperatureC": 32.7,
    "humidityPct": 55,
    "windSpeedMs": 2.22,
    "windDirectionDeg": 74,
    "windGustMs": null,
    "turbulenceIndex": null
  },
  "hourly": [ /* 72 entries, same shape as `current` */ ]
}
```

`condition` drives the map overlay and is one of:
`clear | partly_cloudy | cloudy | rain | windy | hot | unknown`.

Any numeric field inside `current`/`hourly` may be `null` when the upstream
source omits it.

`503` only when the agent fails **and** no snapshot is stored.

---

## Generation & performance

### `GET /plants/{plantId}/generation/live`

Latest reading plus its forecast baseline. Poll this for the "current output"
widget.

```json
{
  "plantId": "6aa532d776c07e2fc075d668",
  "plantName": "Bhadla Solar Park - Block 1",
  "timestamp": "2026-09-12T14:00:00.000Z",
  "generationMW": 364.6,
  "capacityMW": 500,
  "capacityFactorPct": 72.9,
  "sensorStatus": "ok",
  "outage": false,
  "expectedMW": 250,
  "deltaMW": 114.6,
  "deltaPct": 45.8,
  "classification": "higher"
}
```

`404` if the plant has no telemetry at all.

### `GET /plants/{plantId}/performance`

Covers needs **6** and **8**: the lower/usual/higher classification *and* the
reasons behind it. Compares the newest telemetry reading against the newest
cron-generated forecast, then attributes any gap using sensor state and the
stored weather snapshot.

```json
{
  "plantId": "6aa532d776c07e2fc075d66b",
  "plantName": "Muppandal Wind Farm - Phase A",
  "plantType": "wind",
  "capacityMW": 200,
  "evaluatedAt": "2026-09-12T14:33:00.000Z",
  "measuredAt": "2026-09-12T14:00:00.000Z",
  "actualMW": 6.1,
  "expectedMW": 100,
  "deltaMW": -93.9,
  "deltaPct": -93.9,
  "capacityFactorPct": 3.1,
  "classification": "lower",
  "confidencePct": 40,
  "underperforming": true,
  "reasons": [
    {
      "code": "weather_below_forecast_assumption",
      "detail": "Observed conditions support only about 78.3 MW, against the 100.0 MW the forecast assumed — the weather came in worse than predicted.",
      "impact": "high"
    },
    {
      "code": "output_below_weather_potential",
      "detail": "The plant is producing 6.1 MW where current conditions support about 78.3 MW — this gap is not explained by the weather, so check the equipment.",
      "impact": "high"
    }
  ],
  "sensorStatus": "ok",
  "outage": false,
  "forecastGeneratedAt": "2026-09-12T13:35:03.198Z",
  "forecastHorizonHours": 24,
  "weatherSnapshotAt": "2026-09-12T14:10:00.000Z",
  "weather": { /* the matching hourly weather entry */ },
  "weatherImpliedMW": 78.28,
  "usualBandPct": 10
}
```

`classification`: `lower` (>10% below forecast) · `usual` (within ±10%) ·
`higher` (>10% above) · `unknown` (no forecast or no telemetry).

`reasons[].code` values:

| Code | Meaning |
| ---- | ------- |
| `outage` | Latest reading flagged as an outage |
| `sensor_offline` / `sensor_degraded` | Sensor health |
| `weather_below_forecast_assumption` | Conditions came in worse than the forecast assumed |
| `output_below_weather_potential` | Plant trails what current conditions allow — equipment suspect |
| `high_cloud_cover`, `low_irradiance`, `heat_derating`, `rain` | Solar-specific |
| `wind_below_cut_in`, `low_wind_speed`, `wind_cut_out`, `high_turbulence` | Wind-specific |
| `clear_sky`, `strong_wind` | Explain over-performance |
| `no_forecast_baseline`, `no_weather_snapshot` | Missing inputs |
| `unexplained_deviation` | Below forecast with no attributable cause |

`reasons` is `[]` when nothing needs explaining (e.g. output is `usual`).
`impact` is `high | medium | low`.

---

## Forecasts

### `GET /plants/{plantId}/forecast`

Query: `horizon` — `24` (default), `48`, or `72`.

```json
{
  "plantId": "6aa532d776c07e2fc075d668",
  "generatedAt": "2026-09-12T13:35:03.198Z",
  "horizonHours": 24,
  "jobId": "…",
  "points": [
    {
      "time": "2026-09-12T13:35:03.196Z",
      "expectedMW": 250,
      "lowerBoundMW": 175,
      "upperBoundMW": 325,
      "confidencePct": 40
    }
  ],
  "riskWindows": [
    { "start": "…", "end": "…", "type": "over_generation" }
  ]
}
```

`riskWindows[].type`: `over_generation | under_generation | operational_risk`.
`404` when no forecast exists yet for that horizon.

### `POST /plants/{plantId}/forecast`

Body: `{ "horizon": 24 }`. Queues a background agent run; returns `202` with
`{ "jobId", "status": "queued" }`. Rate-limited to 10/min. Results appear on the
`GET` endpoint once the run finishes.

### `GET /plants/{plantId}/history`

Covers needs **10** and **11**. Query: `from`, `to` (ISO 8601; defaults to the
last 7 days). One point per hour.

Each hour is matched to the forecast **generated before that hour**, so the
comparison reflects genuine ahead-of-time predictions rather than hindsight.

```json
{
  "plantId": "6aa532d776c07e2fc075d668",
  "plantName": "Bhadla Solar Park - Block 1",
  "plantType": "solar",
  "capacityMW": 500,
  "from": "2026-09-05T14:33:00.000Z",
  "to": "2026-09-12T14:33:00.000Z",
  "points": [
    {
      "time": "2026-09-12T13:00:00.000Z",
      "actualMW": 409.3,
      "forecastMW": 250,
      "lowerBoundMW": 175,
      "upperBoundMW": 325,
      "confidencePct": 40,
      "errorMW": 159.3,
      "sensorDegraded": false,
      "outage": false,
      "forecastGeneratedAt": "2026-09-12T13:35:03.198Z"
    }
  ],
  "summary": {
    "hours": 100,
    "pairedHours": 2,
    "actualTotalMWh": 14515.4,
    "forecastTotalMWh": 500,
    "peakActualMW": 428.1,
    "maeMW": 136.95,
    "mapePct": 35.2,
    "avgConfidencePct": 40
  }
}
```

`actualMW` is `null` for hours with no telemetry; `forecastMW`,
`lowerBoundMW`, `upperBoundMW` and `confidencePct` are `null` for hours no
forecast covered. **Charts must handle nulls** — early hours typically have
actuals only. `maeMW`/`mapePct` are `null` until at least one hour has both
series (`pairedHours > 0`); see `ASSUMPTIONS.md`.

`400` on an invalid or reversed range.

---

## Recommendations & chat

### `GET /plants/{plantId}/recommendation`

The single latest recommendation. `404` if none exists.

```json
{
  "id": "6aa55507261c12558c085460",
  "plantId": "6aa532d776c07e2fc075d668",
  "generatedAt": "2026-09-12T13:35:03.628Z",
  "action": "hold",
  "amountMW": 0,
  "durationHours": 1,
  "reasoning": "…",
  "constraintsConsidered": ["battery_capacity", "demand_forecast"],
  "forecastResultId": "6aa55507261c12558c08545e"
}
```

`action`: `charge_battery | discharge_battery | curtail | export |
activate_backup | hold`.

### `GET /plants/{plantId}/recommendations`

The notice-board feed. Query: `limit` (default 20, max 100), newest first.

```json
{
  "plantId": "6aa532d776c07e2fc075d668",
  "total": 1,
  "recommendations": [ /* same shape as above */ ]
}
```

Returns `{ total: 0, recommendations: [] }` rather than 404 when empty.

### `GET /plants/{plantId}/explain`

Plain-language rationale for the dashboard root-cause panel.

```json
{ "summary": "…", "factors": ["battery_capacity", "demand_forecast"] }
```

### `POST /plants/{plantId}/chat`

Plant-scoped assistant. Answers only from this plant's stored telemetry,
forecast, weather, recommendation and open alerts. Rate-limited to 20/min.

Request:

```json
{
  "message": "Why is generation below forecast right now?",
  "history": [
    { "role": "user", "content": "…" },
    { "role": "assistant", "content": "…" }
  ]
}
```

`history` is optional; the last 6 turns are used.

Response:

```json
{
  "plantId": "6aa532d776c07e2fc075d668",
  "question": "Why is generation below forecast right now?",
  "reply": "…",
  "contextUsed": {
    "measuredAt": "2026-09-12T14:00:00.000Z",
    "classification": "higher",
    "openAlerts": 1,
    "hasRecommendation": true
  },
  "answeredAt": "2026-09-12T14:35:00.000Z"
}
```

- `400` — empty `message`
- `404` — unknown plant
- `503` — the model is unreachable. **The endpoint never invents an answer**;
  the frontend must show this as an error. Currently returned on every call
  because the configured X.AI key is rejected (see `ASSUMPTIONS.md`).

---

## Alerts & notifications

### `GET /alerts`

Query: `severity` (`low|medium|high`), `plantId`. Newest first.

```json
[
  {
    "id": "6aa532d776c07e2fc075d79a",
    "plantId": "6aa532d776c07e2fc075d668",
    "severity": "medium",
    "type": "shortfall_risk",
    "message": "…",
    "acknowledged": false,
    "acknowledgedAt": null,
    "createdAt": "2026-09-12T11:09:11.867Z"
  }
]
```

Returns a **bare array**, not an envelope. `type`: `curtailment_risk |
shortfall_risk | storage_limit | sensor_fault | extreme_weather`.

There is no `?priority=` parameter — filter with `severity`, or client-side for
an "All" tab.

### `POST /alerts/{alertId}/acknowledge`

No body. Returns the updated alert. `404` if unknown.

### Real-time push

Socket.IO on the server origin (`http://localhost:5000`), CORS open. Event
`new_alert` fires with `{ id, plantId, severity, type, message, createdAt }`.
Polling `GET /alerts` is a valid fallback.

### `GET /notifications`

Covers need **9**. Read-only audit trail — **email sending is backend-only and
has no frontend trigger**. Query: `plantId`, `channel` (`socket|email`),
`status` (`sent|skipped|failed`), `limit` (default 50, max 200).

```json
{
  "emailConfigured": false,
  "total": 2,
  "notifications": [
    {
      "id": "…",
      "alertId": "…",
      "plantId": "…",
      "channel": "email",
      "status": "skipped",
      "recipient": null,
      "severity": "high",
      "type": "sensor_fault",
      "subject": "[FluxCast HIGH] sensor_fault — Bhadla Solar Park - Block 1",
      "detail": "SMTP_HOST / ALERT_EMAIL_TO are not configured in the environment",
      "createdAt": "…"
    }
  ]
}
```

Escalation rule: only `severity: "high"` **or** `type: "sensor_fault"` alerts
attempt an email; everything else is logged as `skipped`. With SMTP unset,
`emailConfigured` is `false` and every email row is `skipped` — the frontend
should surface that rather than implying mail went out.

---

## Portfolio & simulation

### `GET /portfolio/forecast`

Query: `plantIds` (comma-separated; omit for all), `horizon` (24/48/72).

```json
{
  "generatedAt": "…",
  "horizonHours": 24,
  "totalExpectedMW": [
    { "time": "…", "expectedMW": 100, "lowerBoundMW": 85, "upperBoundMW": 115 }
  ],
  "plantBreakdown": [ { "plantId": "…", "expectedMW": 6000 } ]
}
```

Empty arrays when no forecasts exist (not a 404).

### `POST /simulate`

Body `{ plantId, scenario, overrides }`. Runs the agent chain with overrides and
**persists nothing**. Rate-limited to 5/min; slow (full LLM chain).

### `GET /health`

Outside `/v1` and outside the OpenAPI contract: `{ "status": "ok", "db": "connected" }`.

---

## Polling intervals used by the frontend

| Data | Interval | Why |
| ---- | -------- | --- |
| `generation/live`, `performance` | 30s | Telemetry lands hourly; 30s keeps the UI responsive without load |
| `alerts` | 20s | Backs up the Socket.IO push |
| `weather` | 5min | Server-cached for 60min anyway |
| `recommendation`, `recommendations` | 5min | Regenerated by the hourly cron |
| `forecast` | 5min | Regenerated by the hourly cron |
| `history` | on demand | Refetched when the date range changes |
