# FluxCast Backend

FluxCast is a renewable generation forecasting and grid decision-support backend. It combines weather data, plant telemetry, and a four-stage LLM agent pipeline to produce hourly solar/wind generation forecasts, grid-action recommendations, and plain-language explanations for grid operators.

## Contents

- [Architecture](#architecture)
- [Module Workflow](#module-workflow)
- [LLM Agent Workflow](#llm-agent-workflow)
- [API Reference](#api-reference)
- [Renewable Energy Glossary](#renewable-energy-glossary)
- [Getting Started](#getting-started)

## Architecture

```
Client (dashboard / Postman)
        |
        v
Express API (/v1) --- OpenAPI request validation --- JWT auth middleware
        |
        v
LangGraph-style workflow (services/graph/forecastWorkflow.js)
  WeatherReasoningAgent -> ForecastingAgent -> DecisionAgent -> ExplainabilityAgent
        |
        v
MCP tools (weather fetch, telemetry read, RAG search, battery/demand stubs, alerts)
        |
        v
MongoDB (Users, Plants, Telemetry, WeatherSnapshots, Forecasts, Recommendations, Alerts)
```

Requests are validated against `openapi.yaml` before reaching any route handler. Every protected route requires a `Bearer` JWT issued by `/v1/auth/login`.

## Module Workflow

- `src/config` - `env.js` loads and validates required environment variables at startup; `db.js` connects to the configured MongoDB URI and automatically falls back to a local MongoDB instance if that connection fails.
- `src/models` - Mongoose schemas: `User`, `Plant`, `Telemetry`, `WeatherSnapshot`, `ForecastResult`, `Recommendation`, `Alert`. These define the exact shape of every persisted document.
- `src/middleware` - `authMiddleware` verifies the JWT and attaches `req.user`; `openApiValidatorSetup` rejects any request that does not match `openapi.yaml`; `errorHandler` turns thrown errors into a consistent `{ error, message }` JSON response.
- `src/routes` - one Express router per resource (auth, plants, weather, forecast, recommendation/explain, simulate, alerts, portfolio). Routers are mounted under `/v1` in `app.js`.
- `src/services/auth` - `authService.js` handles login, registration, password hashing/verification, and password reset token issuance.
- `src/services/agents` - the four LLM-driven agents that make up the forecasting pipeline (see next section).
- `src/services/graph/forecastWorkflow.js` - runs the four agents in sequence, passing a single shared state object between them and logging each step for auditability.
- `src/services/mcp-tools` - single-purpose tool functions the agents call: fetching weather (`openMeteoTool`, `nasaGisTool`/`nasaPowerTool`, `mosdacTool` - now an Open-Meteo alias), reading telemetry (`telemetryTool`), similarity search for new plants (`ragRetrieverTool`), battery/demand stubs (`batteryStatusTool`, `demandDataTool`), generic persistence (`dbReadWriteTool`), and alerting (`notificationTool`).
- `src/services/connectors` - the raw HTTP/DB clients underneath the tools: `openMeteoConnector`, `nasaConnector`, `telemetryConnector`. `mosdacConnector` is a legacy name kept for compatibility and now simply calls the Open-Meteo connector.
- `src/jobs` - `node-cron` schedules: an hourly job that runs the full forecast workflow for every plant, and a 3-hourly job that pre-fetches and caches a weather snapshot.
- `src/sockets/alertSocket.js` - initializes Socket.IO and emits a `new_alert` event to connected dashboards whenever a risk window triggers a notification.
- `src/scripts` - `seed.js` populates sample users, plants, and telemetry; `generateMockTelemetryCsv.js` and `importTelemetryCsv.js` create and load a reproducible CSV telemetry fixture for testing.
- `src/utils/logger.js` - shared Winston logger used across the codebase.
- `src/app.js` builds the Express app (middleware, routes, error handler); `src/server.js` is the process entry point - it connects to the database, starts the HTTP server and Socket.IO, and starts the cron jobs.

## LLM Agent Workflow

Every forecast run (scheduled, manually triggered, or simulated) executes the same four-node chain, defined in `services/graph/forecastWorkflow.js`. Each agent calls an LLM (X.AI Grok, via the OpenAI-compatible `ChatOpenAI` client) with a strict system prompt and expects a JSON-only response; if the LLM call fails or returns invalid JSON, each agent falls back to a deterministic default so the pipeline never hard-fails.

1. **WeatherReasoningAgent** (`weatherReasoningAgent.js`) - fetches numerical forecast data from Open-Meteo and satellite-derived data from NASA POWER in parallel, then asks the LLM to reconcile the two sources into one trusted hourly weather snapshot. Falls back to raw Open-Meteo data if reconciliation fails. Result is persisted as a `WeatherSnapshot`.
2. **ForecastingAgent** (`forecastingAgent.js`) - reads the plant's recent telemetry (and, for plants with `hasLimitedHistory: true`, runs a vector similarity search over historical patterns via `ragRetrieverTool`). Combines this with the weather snapshot and asks the LLM to produce an hourly generation forecast with uncertainty bounds and any risk windows (over-generation, under-generation, operational risk). Falls back to a flat 50%-of-capacity curve on failure. Result is persisted as a `ForecastResult`.
3. **DecisionAgent** (`decisionAgent.js`) - reads current battery state of charge and grid demand, then asks the LLM to pick one grid action (`charge_battery`, `discharge_battery`, `curtail`, `export`, `activate_backup`, `hold`) that respects those constraints. Falls back to `hold` on failure. Persisted as a `Recommendation`, unless the run is a simulation.
4. **ExplainabilityAgent** (`explainabilityAgent.js`) - turns the forecast and recommendation into a short, operator-facing explanation, and raises an `Alert` (persisted + pushed via Socket.IO) for any risk window found in the forecast. Skipped for simulations, which never persist or alert.

`simulationMode: true` (used by `POST /v1/simulate`) runs the identical chain with optional overrides, but skips all persistence and alerting so what-if scenarios never affect real stored data.

## API Reference

All endpoints are prefixed with `/v1` and validated against `openapi.yaml`. Endpoints marked "Yes" require an `Authorization: Bearer <token>` header.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | No | Authenticate with email/password and receive a JWT. |
| GET | `/plants` | Yes | List registered plants, filterable by type, paginated. |
| POST | `/plants` | Yes | Register a new solar or wind plant. |
| GET | `/plants/:plantId` | Yes | Get a single plant's metadata and capacity specs. |
| PATCH | `/plants/:plantId` | Yes | Update a plant's metadata. |
| DELETE | `/plants/:plantId` | Yes (admin/utility_admin) | Remove a plant. |
| GET | `/plants/:plantId/telemetry` | Yes | Retrieve recent (default 4 days) actual generation and sensor history. |
| POST | `/plants/:plantId/telemetry` | Yes | Ingest a new SCADA/inverter telemetry reading. |
| GET | `/plants/:plantId/weather` | Yes | Get the reconciled weather snapshot for a plant's location, produced by the WeatherReasoningAgent. |
| GET | `/plants/:plantId/forecast` | Yes | Get the most recently generated forecast for a given horizon (24/48/72h). |
| POST | `/plants/:plantId/forecast` | Yes | Trigger a fresh run of the full agent workflow in the background; returns a `jobId` immediately. |
| GET | `/plants/:plantId/recommendation` | Yes | Get the DecisionAgent's latest recommended grid action. |
| GET | `/plants/:plantId/explain` | Yes | Get the ExplainabilityAgent's plain-language rationale for the current forecast/recommendation. |
| POST | `/simulate` | Yes | Re-run the workflow with temporary overrides (demand spike, outage, etc.) without touching stored data. |
| GET | `/alerts` | Yes | List alerts, filterable by severity and plant. |
| POST | `/alerts/:alertId/acknowledge` | Yes | Mark an alert as acknowledged. |
| GET | `/portfolio/forecast` | Yes | Aggregated generation forecast summed across multiple (or all) plants. |
| GET | `/health` | No | Server and database connection status. Not part of the OpenAPI contract. |

## Renewable Energy Glossary

Terms used throughout the API responses and agent logic:

- **GHI (Global Horizontal Irradiance)** - total solar radiation received per unit area on a horizontal surface; the primary driver of solar generation.
- **DNI (Direct Normal Irradiance)** - solar radiation received per unit area by a surface held perpendicular to the sun's rays; relevant for tracking solar systems.
- **Cloud cover percentage** - fraction of sky covered by cloud, used to discount expected irradiance.
- **Turbulence index** - a measure of short-term wind variability at a site; higher values indicate less predictable wind generation.
- **Capacity (capacityMW)** - the maximum power output a plant can produce, in megawatts.
- **Panel tilt / azimuth** - the angle a solar panel is mounted at, and the compass direction it faces; both affect how much irradiance a panel actually captures.
- **Hub height / rotor diameter** - for wind turbines, the height of the nacelle above ground and the diameter swept by the blades; both affect how much wind energy a turbine can capture.
- **Cut-in, rated, and cut-out speed** - wind turbine thresholds: below cut-in (3 m/s in this system) the turbine produces nothing; between cut-in and rated speed (12 m/s) output rises roughly with the cube of wind speed; between rated and cut-out speed (25 m/s) the turbine produces at full capacity; above cut-out it shuts down to avoid damage.
- **State of charge (SoC) / battery charge percent** - how full a battery storage system is, expressed as a percentage of its maximum capacity; used to decide whether the grid can absorb more generation or needs to draw on storage.
- **Curtailment** - deliberately reducing generation output (e.g. by throttling panels or turbines) because the grid cannot use or store the available power.
- **Grid actions** - the recommendation set: `charge_battery` (store surplus), `discharge_battery` (draw from storage to cover a shortfall), `curtail` (reduce output), `export` (send surplus to the wider grid), `activate_backup` (bring backup generation online during a shortfall), `hold` (no action needed).
- **Risk windows** - time ranges flagged in a forecast: `over_generation` (sustained output near or above capacity, risking curtailment), `under_generation` (output well below capacity during hours when it is expected, risking a supply shortfall), `operational_risk` (a degraded sensor or outage detected in recent telemetry).
- **Uncertainty bounds (lowerBoundMW / upperBoundMW) and confidence percentage** - the forecast is a range, not a single number; confidence percentage reflects how reliable that range is judged to be, and drops when recent telemetry shows sensor problems.
- **Demand forecast** - projected grid electricity demand used to compare against expected generation before recommending an action.
- **Transmission limit / ramp rate** - grid-side constraints considered by the DecisionAgent: the maximum power a line can carry, and the maximum rate at which output can be safely increased or decreased.
- **RAG (retrieval-augmented generation) / vector search** - for newly commissioned plants with little history (`hasLimitedHistory: true`), the ForecastingAgent retrieves similar historical weather/generation patterns from other plants to inform its forecast, instead of relying solely on that plant's own limited telemetry.

## Getting Started

1. `npm install`
2. `cp .env.example .env` and fill in `MONGODB_URI` and `JWT_SECRET` (an `XAI_API_KEY` is optional - every agent falls back gracefully without one).
3. `npm run seed` to create sample users, plants, and telemetry (or `npm run mock:csv:import` to load the CSV test fixture instead).
4. `npm run dev` to start the server on `PORT` (default 5000).
5. `npm test` to run the Jest test suite (route contract tests, agent unit tests, and a CSV-driven end-to-end pipeline test).

Default seeded login: `admin@fluxcast.io` / `Password123!` (also `operator@fluxcast.io`, `utility@fluxcast.io`).
