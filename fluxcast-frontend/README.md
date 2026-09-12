# FluxCast Frontend

Operator console for the FluxCast renewable generation forecasting platform.
Role-based sign-in, a live plant dashboard with map and alerts, forecast-vs-actual
history, and a plant-scoped AI assistant.

Built against the real backend in `../fluxcast-backend` — there are no mocked
endpoints or fixture data anywhere in this app. Every endpoint it calls is
documented in [`../API_CONTRACT.md`](../API_CONTRACT.md); judgement calls and
known environment constraints are in [`../ASSUMPTIONS.md`](../ASSUMPTIONS.md).

---

## Quick start

The backend must be running first — this app has no offline mode.

```bash
# 1. Backend (separate terminal)
cd ../fluxcast-backend
npm install
npm run seed                     # once: creates the 3 role users, plants, telemetry
npm run mock:telemetry:catchup   # tops the mock SCADA feed up to the current hour
npm start                        # http://localhost:5000

# 2. Frontend
npm install
npm run dev                      # http://localhost:5173
```

Open http://localhost:5173, pick a role, pick a plant.

> Run `npm run mock:telemetry:catchup` before a demo. Seeded telemetry stops at
> seed time, and without fresh readings the live panel and history chart have
> little to show. See `ASSUMPTIONS.md`.

### Scripts

| Script | What it does |
| ------ | ------------ |
| `npm run dev` | Vite dev server with HMR on :5173 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built output locally |
| `npm run lint` | oxlint over `src/` |

### Environment

Copy `.env.example` to `.env` (the committed `.env` already points at a local
backend).

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `VITE_API_BASE_URL` | `http://localhost:5000/v1` | REST base URL |
| `VITE_SOCKET_URL` | `http://localhost:5000` | Socket.IO origin for live alerts (server root, **not** `/v1`) |

---

## Structure

```
src/
  api/         axios instance + one module per resource, plus polling config
  components/  shared UI: Card, StatusBadge, States, ErrorBoundary
  features/
    auth/      role-selection screen
    plants/    plant picker
    dashboard/ map, alerts panel, AI decision card, stat tiles
    history/   date range picker + the two charts
    decisions/ notice board + chatbot
  hooks/       React Query hooks, one file per domain, keys in queryKeys.js
  layouts/     DashboardLayout (sidebar + outlet)
  routes/      ProtectedRoute, 404
  store/       Zustand: auth session, selected plant
  utils/       formatting and the status/severity colour vocabulary
```

---

## Library choices

The stack was fixed by the build plan: **React + JavaScript (Vite), Tailwind CSS,
React Router v6, TanStack Query**. The supporting picks:

**`react-leaflet` + `leaflet` — map.** The dashboard needs zoom-to-plant, a
custom status-coloured marker, a hover tooltip and a weather overlay. Leaflet
does all four over OpenStreetMap tiles with **no API token and no billing
account**. Mapbox GL renders better at scale but needs a token nobody here has,
which would leave the map blank — a hard blocker traded for polish we do not
need at one-site zoom.

**`recharts` — charts.** The forecast-vs-actual chart is a composite: an `Area`
for the uncertainty band with two `Line`s over it, and the history series is
full of nulls (hours with an actual but no forecast, and vice versa). Recharts
composes those as JSX and handles gaps with `connectNulls`. Chart.js would need
an imperative wrapper and manual gap handling for the same picture.

**`zustand` — client state.** Only two things live outside the server cache: the
session and the selected plant. The `persist` middleware gives the localStorage
session in a few lines.

**`axios` — HTTP.** Interceptors put the role headers and error normalisation in
one place. Its `paramsSerializer` also solved a real bug: axios leaves `:`
unencoded in query strings, which the backend's OpenAPI validator rejects, so
every ISO timestamp in a history query would 400.

**`socket.io-client` — live alerts.** Matches the backend's Socket.IO server,
which emits `new_alert` when the agent pipeline raises one.

**`date-fns`, `lucide-react`** — date formatting and icons, both named in the plan.

---

## How data flows

**Auth.** The backend issues no token — login resolves which of three predefined
users you are. The axios interceptor therefore sends `x-user-role` (plus id and
email) rather than a bearer token, and "session" means Zustand state persisted
to `localStorage`.

**Real-time.** Socket.IO for alerts; React Query polling for everything else,
because the rest only changes when the backend's hourly cron runs. Every
interval is defined in `src/api/config.js`:

| Data | Interval |
| ---- | -------- |
| Live generation, performance | 30s |
| Alerts | 20s (backs up the socket push) |
| Weather | 5min (server caches for 60min) |
| Forecast, recommendations | 5min |
| History | on demand, cached per date range |

**Async states.** Every view handles loading, error and empty separately —
skeletons while fetching, `ErrorState` with retry on failure, and `EmptyState`
for genuinely empty results. `ErrorBoundary` wraps each dashboard panel so one
failing widget cannot blank the screen.

---

## Accessibility

- The map is `aria-hidden`; the same figures appear in the stat tiles and the
  **Site summary** block beneath it, which is also what makes the hover-only
  tooltip content usable on touch devices.
- Both charts carry a written caption explaining what they show, and the
  accuracy figures are repeated as text in the summary tiles above them.
- Sidebar navigation is standard links, tabbable in order, with a visible focus
  ring defined in `index.css`.
- Filter buttons expose `aria-pressed`; the chat transcript is an `aria-live`
  log; loading regions carry `role="status"`.

---

## Known behaviour worth expecting

These are real states of the current environment, not bugs — full detail in
`../ASSUMPTIONS.md`:

- **The chatbot returns an error.** The configured X.AI key is rejected by
  x.ai, so `POST /chat` answers `503`. The UI shows that plainly rather than
  inventing a reply. Add a working key to `fluxcast-backend/.env` and it works.
- **Forecasts look flat at 40% confidence.** Same cause: the agents fall back to
  a deterministic curve when the model call fails, and the dashboard plots
  whatever is stored.
- **The forecast line covers only part of the history chart.** Forecasts look
  forward and telemetry looks back, so overlap accumulates as the hourly cron
  runs. The chart says so when coverage is thin.
