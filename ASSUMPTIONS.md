# FluxCast — Assumptions & Known Constraints

Every judgement call made while building against `plan.md`, plus the real-world
constraints of the current environment. Recorded 2026-09-12.

---

## Blocking environment issues

### 1. The X.AI API key is rejected — AI output is currently fallback data

`XAI_API_KEY` in `fluxcast-backend/.env` is not accepted by x.ai. Verified
directly against the API:

```
400 "Incorrect API key provided. You can obtain an API key from https://console.x.ai."
```

`XAI_MODEL=grok-4.3` **is** a valid model — probing confirms it passes x.ai's
model-existence check and fails only on the credential. The key itself is the
problem.

Consequences, all visible in the UI today:

- Forecasts stored in the database are the Forecasting Agent's deterministic
  fallback: a **flat 50%-of-capacity curve at `confidencePct: 40`**. That is why
  Bhadla shows `expectedMW: 250` for every hour of a 500 MW plant.
- Recommendations read `"Could not generate recommendation — defaulting to
  hold."` with `constraintsConsidered: ["system_error"]` — the Decision Agent's
  fallback.
- `POST /plants/{id}/chat` returns `503` on every call.

**Nothing in the frontend fakes around this.** The chatbot surfaces the error,
and forecast charts plot whatever is stored. Drop a working key into
`fluxcast-backend/.env`, restart, and let the hourly cron run (or `POST
/plants/{id}/forecast`) — real model output flows through with no code change.

### 2. Mock telemetry needs topping up

There is no live SCADA integration. `npm run seed` writes 96 hours of mock
readings ending at seed time, and they immediately start going stale, which
leaves the dashboard's live panel and the history chart short of recent data.

`npm run mock:telemetry:catchup` (added in Phase 0) extends the feed from each
plant's last reading to the current hour using the same generation curves as
`seed.js`. Run it before a demo. It is a deliberate, separately-invoked script —
never called from application code.

### 3. Forecast-vs-actual overlap accumulates over time

Forecasts look 24h forward; telemetry looks backward. Immediately after seeding
they do not overlap, so `GET /history` returns `pairedHours: 0` and
`maeMW`/`mapePct` are `null`. Overlap builds as the hourly forecast cron runs
and telemetry catches up. The history chart is built to render an actuals-only
series and states plainly when no paired hours exist — it does not invent a
forecast line.

### 4. One corrupt legacy telemetry record

A single reading is dated `1962-04-13` at `2129.6 MW` — above its plant's 500 MW
capacity. It came from an earlier CSV import, sits outside every default query
window, and was **left in place** rather than deleted from the user's database.
It only appears if someone picks a date range spanning 1962.

---

## Product decisions

### Roles and scoping (plan §2, need #2)

The backend has exactly three predefined roles — System Admin, Lead Grid
Operator, Utility Admin — so the plan's suggested "Admin/Operator/Viewer" was
not needed; the real names are used.

All three are organisation-wide: `Plant` has no owner/tenant field, so every
role sees all plants. `GET /plants` is therefore "scoped to the current user" in
the sense that it returns everything that user may see. No fake ownership model
was invented.

Role-based access applies to exactly one route: `DELETE /plants/{plantId}`
requires `admin` or `utility_admin`. The frontend does not expose plant
deletion, so no role guard is applied to any route.

### Auth has no token

Login returns a user object, not a JWT — by design from earlier work in this
repo. So:

- The axios interceptor sends `x-user-role` (plus `x-user-id`/`x-user-email`)
  rather than `Authorization: Bearer`.
- There is no refresh flow and a `401` handler would be dead code, so the
  response interceptor normalises errors instead.
- "Session" means Zustand state persisted to `localStorage`. Clearing browser
  storage logs the user out; nothing is invalidated server-side.

### Alert priority = severity

The plan says "priority filter (All / High / Medium / Low)". The backend field
is `severity` with exactly those three levels. "All" is client-side (no request
param); the other three map to `?severity=`.

### Email is display-only (need #9)

Confirmed backend-only, as Phase 4 asked us to check. `notificationTool` writes
the alert, pushes it over Socket.IO, and attempts an email for high-severity or
sensor-fault alerts. The frontend never triggers or acknowledges a send — it
reads `GET /notifications` and shows the outcome, including `skipped` when SMTP
is unconfigured (the current state, since `SMTP_HOST`/`ALERT_EMAIL_TO` are
unset).

Alert **acknowledgement** is separate and is wired up (`POST
/alerts/{id}/acknowledge`).

### Classification thresholds (needs #6, #8)

`lower` / `usual` / `higher` are not defined anywhere in the backend, so:

> Deviation within **±10%** of the forecast is `usual`; beyond that it is
> `lower` or `higher`. Below **0.5 MW** output counts as zero, so a solar plant
> at night reads `usual` rather than a 100% miss.

Exposed as `usualBandPct` in the response so the UI never hardcodes it.

### Underperformance reasons are computed, not generated

Need #6 is answered by deterministic analysis of stored data, not by an LLM:
sensor status, outage flags, and the weather snapshot. The service also computes
what the observed weather *should* yield, using the same panel/turbine curves
the Forecasting Agent is prompted with, which separates two very different
situations:

- `weather_below_forecast_assumption` — conditions came in worse than forecast.
- `output_below_weather_potential` — conditions are fine, the plant is not
  delivering. Equipment problem.

Both can fire at once. This keeps working when the LLM is down, which is exactly
when an operator needs it.

### Cron classification reuses `/performance` (need #8)

Rather than a second endpoint, `/performance` compares the newest telemetry
against the newest **cron-generated** forecast and returns
`forecastGeneratedAt` alongside the classification. One request answers both
"what did the scheduled AI predict" and "how are we doing against it".

### Weather caching

The weather agent calls two external APIs plus an LLM, so calling it per poll
was untenable. Stored snapshots are served for `WEATHER_CACHE_MINUTES`
(default 60, configurable) with `?refresh=true` to force a run. Response carries
`cached` and `ageMinutes` so the UI can show data age.

### Map condition labels

`condition` is derived server-side from the weather data and checked in order of
operational significance: rain ≥60% → `rain`; wind ≥15 m/s → `windy`; cloud ≥70%
→ `cloudy`; cloud ≥30% → `partly_cloudy`; temp ≥38°C → `hot`; else `clear`.
Server-side so the map and any future consumer agree.

---

## Frontend library choices

Fixed by the plan: React + JavaScript (Vite), Tailwind, React Router v6,
TanStack Query.

| Choice | Why |
| ------ | --- |
| **react-leaflet + leaflet** | Plan needs zoom-to-plant, custom markers, hover popups, weather overlay. Leaflet does all four with OpenStreetMap tiles and **no API key or billing account** — Mapbox GL would need a token the user does not have, and would block the map entirely. |
| **Recharts** | Composable React primitives make the forecast-vs-actual + confidence-band charts straightforward: `<Area>` for the bound band with `<Line>` overlaid, and native `connectNulls` handling for the gappy history series. Chart.js would need an imperative wrapper for the same result. |
| **Zustand** | Called for by the plan; `persist` middleware gives the localStorage session for free. |
| **axios** | Called for by the plan; interceptors give one place for the role headers and error normalisation. |
| **date-fns** | Called for by the plan; used for range presets and axis formatting. |
| **lucide-react** | Called for by the plan; icon set for sidebar, alerts and weather. |
| **socket.io-client** | Matches the backend's Socket.IO server for live alert push, with polling as the fallback. |

### Real-time strategy

Socket.IO for alerts (server already emits `new_alert`), React Query polling for
everything else. Intervals are centralised in `src/api/config.js` and listed in
`API_CONTRACT.md`. Polling beats sockets for the rest because the underlying
data only changes when the hourly cron runs.

---

## Scope boundaries

Built because the plan asks for it: auth, plant selection, dashboard (map +
alerts + AI card), history, decisions + chatbot, polish.

Deliberately **not** built, since no plan phase calls for them: plant CRUD
(create/edit/delete), the `/simulate` what-if screen, and the
`/portfolio/forecast` multi-plant view. All three endpoints exist and are
documented in `API_CONTRACT.md` if they are wanted later.
