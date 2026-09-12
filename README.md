# FluxCast Backend

> **AI-Powered Renewable Generation Forecasting & Autonomous Grid Decision Platform**

FluxCast is an enterprise-grade renewable energy forecasting and grid dispatch optimization backend. It synthesises high-resolution numerical weather prediction models (Open-Meteo API) and satellite irradiance observations (NASA POWER API) with plant telemetry to deliver hourly solar/wind generation forecasts, operational risk alerts, and automated grid-balancing recommendations (battery storage dispatch, curtailment, export).

---

## ⚡ Key Capabilities

- **Multi-Source Weather Reasoning:** Harmonises numerical forecasts from Open-Meteo (https://api.open-meteo.com/v1/forecast) and NASA POWER satellite observations (https://power.larc.nasa.gov/api/) using physics weighting and LLM reasoning.
- **4-Agent LangGraph Pipeline:**
  1. `WeatherReasoningAgent` — reconciles divergent met models into a trusted hourly snapshot.
  2. `ForecastingAgent` — physics-informed renewable generation projection with uncertainty bounds & risk windows. Supported by MongoDB Atlas Vector Search (RAG) for new plants with limited telemetry.
  3. `DecisionAgent` — recommends optimal grid actions (`charge_battery`, `discharge_battery`, `curtail`, `export`, `activate_backup`, `hold`) given battery SoC and demand constraints.
  4. `ExplainabilityAgent` — delivers human-operator reasoning summaries and automatically triggers alerts for risk periods.
- **X.AI Grok Integration:** Powered by the X.AI Grok API (`https://api.x.ai/v1`, model `grok-beta`) via OpenAI-compatible LangChain client.
- **Model Context Protocol (MCP) Tools:** Clean modular interface connecting agents to external APIs, telemetry, vector search, and DB writes.
- **Real-Time Push:** Socket.IO pushes `new_alert` events instantly to operator consoles.
- **Automated Operations:** Hourly forecast generation (`5 * * * *`) and 3-hourly weather pre-fetching (`0 */3 * * *`) via `node-cron`.
- **OpenAPI 3.0 Contract Validation:** Strict request validation against [`openapi.yaml`](./openapi.yaml) via `express-openapi-validator`.

---

## 🏗️ Architecture

```
                                  ┌─────────────────────────────┐
                                  │   Grid Operator Dashboard   │
                                  └──────────────┬──────────────┘
                                                 │ HTTP / WebSocket
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Express.js API Layer (/v1)                                                                  │
│  ├── /auth/login         ├── /plants/:id/forecast     ├── /simulate                         │
│  ├── /plants (+ SCADA)   ├── /plants/:id/recommend    ├── /alerts                           │
│  ├── /plants/:id/weather ├── /plants/:id/explain      ├── /portfolio/forecast               │
└────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ LangGraph Workflow Chain (X.AI Grok-Powered)                                               │
│                                                                                             │
│  [Weather-Reasoning Agent] ──▶ [Forecasting Agent] ──▶ [Decision Agent] ──▶ [Explain Agent] │
│            │                          │                      │                      │       │
│            ▼                          ▼                      ▼                      ▼       │
│     ┌─────────────┐            ┌─────────────┐        ┌─────────────┐        ┌────────────┐ │
│     │ openMeteo   │            │ telemetry   │        │ battery     │        │ notify     │ │
│     │ mosdac      │            │ ragRetrieve │        │ demand      │        │ (Alert &   │ │
│     │ nasaGis     │            │ dbReadWrite │        │ dbReadWrite │        │  Socket.IO)│ │
│     └─────────────┘            └─────────────┘        └─────────────┘        └────────────┘ │
│                                MCP Tool Layer                                               │
└────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                         │
                        ┌────────────────┴────────────────┐
                        ▼                                 ▼
         ┌─────────────────────────────┐   ┌─────────────────────────────┐
         │     MongoDB Atlas Cluster   │   │       External APIs         │
         │  • Users      • Plants      │   │  • X.AI Grok                │
         │  • Telemetry  • Forecasts   │   │  • Open-Meteo API (NWP)     │
         │  • Recs       • Alerts      │   │  • NASA POWER API (Met/Sol) │
         │  • Vector Index (RAG)       │   │                             │
         └─────────────────────────────┘   └─────────────────────────────┘
```

---

## 🛠️ Tech Stack

- **Runtime:** Node.js 18+ (CommonJS)
- **Framework:** Express.js 4.19
- **Database:** MongoDB Atlas + Mongoose 8.4
- **AI / LLM Orchestration:** LangChain.js, LangGraph.js, `@langchain/openai`
- **Model Provider:** X.AI Grok (`grok-beta`)
- **Real-Time Communication:** Socket.IO 4.7
- **Job Scheduling:** `node-cron`
- **Specification & Validation:** OpenAPI 3.0.3, `express-openapi-validator`
- **Security:** Helmet, CORS, bcrypt, JWT, `express-rate-limit`
- **Logging:** Winston + Morgan
- **Testing:** Jest + Supertest (11 test suites, 40 unit/integration tests)

---

## 🚀 Getting Started

### 1. Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- MongoDB Atlas cluster connection URI (or local MongoDB 6+)
- X.AI Grok API key (get one from [console.x.ai](https://console.x.ai))

### 2. Installation

```bash
cd fluxcast-backend
npm install
```

### 3. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure your variables:

```ini
# MongoDB Atlas
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/fluxcast?retryWrites=true&w=majority

# JWT Authentication
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=24h

# Server
PORT=5000
NODE_ENV=development

# X.AI Grok API
XAI_API_KEY=your_xai_api_key_here
XAI_BASE_URL=https://api.x.ai/v1
XAI_MODEL=grok-beta

# Weather Services
OPEN_METEO_BASE_URL=https://api.open-meteo.com/v1/forecast
# NASA POWER Proxy Server (Local FastAPI service in ../nasa-power-api-main)
NASA_POWER_BASE_URL=http://localhost:8000
# NASA_API_KEY is not required when using the local proxy
```

### 4. Seed Sample Data

Run the database seed script to insert test users, sample solar/wind plants, and 96 hours of hourly SCADA telemetry:

```bash
npm run seed
```

Default credentials created:
- **Admin:** `admin@fluxcast.io` / `Password123!`
- **Operator:** `operator@fluxcast.io` / `Password123!`
- **Utility:** `utility@fluxcast.io` / `Password123!`

### 5. Running the Application

**Development (with live-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

---

## 🧪 Testing

Run the automated test suite with Jest:

```bash
npm test
```

Generate test coverage report:
```bash
npm run test:coverage
```

All 11 test suites mock external network calls and MongoDB connections, ensuring fast, deterministic contract tests:
- `tests/routes/auth.test.js`
- `tests/routes/plants.test.js`
- `tests/routes/alerts.test.js`
- `tests/routes/forecast.test.js`
- `tests/routes/recommendation.test.js`
- `tests/routes/simulate.test.js`
- `tests/routes/portfolio.test.js`
- `tests/routes/weather.test.js`
- `tests/services/openMeteoConnector.test.js`
- `tests/services/telemetryConnector.test.js`
- `tests/services/notificationTool.test.js`

---

## 📡 API Reference

All endpoints are prefixed with `/v1`:

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/v1/auth/login` | Authenticate and obtain JWT token | No |
| `GET` | `/v1/plants` | List all registered solar and wind plants | Yes |
| `POST` | `/v1/plants` | Register a new generation plant | Yes |
| `GET` | `/v1/plants/:id` | Get plant metadata & capacity specifications | Yes |
| `PATCH` | `/v1/plants/:id` | Update plant specifications | Yes |
| `DELETE` | `/v1/plants/:id` | Remove a plant (Admin / Utility Admin only) | Yes (`admin`) |
| `GET` | `/v1/plants/:id/telemetry` | Retrieve last N days of actual generation | Yes |
| `POST` | `/v1/plants/:id/telemetry` | Ingest SCADA / inverter telemetry point | Yes |
| `GET` | `/v1/plants/:id/weather` | Fetch reconciled weather forecast snapshot | Yes |
| `GET` | `/v1/plants/:id/forecast` | Retrieve latest generation forecast (24/48/72h) | Yes |
| `POST` | `/v1/plants/:id/forecast` | Trigger fresh agent workflow (queued background job) | Yes |
| `GET` | `/v1/plants/:id/recommendation` | Get Decision Agent's recommended grid action | Yes |
| `GET` | `/v1/plants/:id/explain` | Get plain-language rationale & constraint factors | Yes |
| `POST` | `/v1/simulate` | Run what-if scenario with temporary overrides | Yes |
| `GET` | `/v1/alerts` | List active alerts filterable by severity/plant | Yes |
| `POST` | `/v1/alerts/:id/acknowledge` | Acknowledge/clear an alert | Yes |
| `GET` | `/v1/portfolio/forecast` | Aggregated generation time-series across plants | Yes |
| `GET` | `/health` | Server & DB connection health check | No |

---

## 🔌 Socket.IO Real-Time Events

Connect to Socket.IO server on port `5000`:

```javascript
const socket = io('http://localhost:5000');

socket.on('new_alert', (alert) => {
  console.log(`[ALERT] [${alert.severity.toUpperCase()}] ${alert.type}: ${alert.message}`);
});
```

---

## 📜 License

ISC License.
