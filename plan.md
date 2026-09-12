# FluxCast — Claude Code Build Plan

> **How to use this file:** This is your working brief. Execute the phases in order. Do **not** skip Phase 0 — the frontend is built against real, verified API contracts, not mocks. After each phase, run the stated checkpoint and commit before moving on. If a requirement is ambiguous, make a reasonable assumption, note it in `ASSUMPTIONS.md` at the repo root, and keep going.

---

## Operating Rules (read before starting)

1. **Work phase by phase.** Complete a phase, hit its checkpoint, `git commit`, then proceed.
2. **No throwaway mocks.** The frontend consumes real backend endpoints. If an endpoint is missing, fix the backend in Phase 0 first.
3. **Single source of truth for the API.** Maintain `API_CONTRACT.md` at the repo root. Every endpoint the frontend calls must be documented there (method, path, params, request body, response shape, auth).
4. **Track assumptions.** Any guess (role names, alert priority levels, forecast granularity, etc.) goes in `ASSUMPTIONS.md`.
5. **Stack is fixed:** React + JavaScript (Vite), Tailwind CSS, React Router v6, TanStack Query (React Query). You choose supporting libs (map, charts, state, http) and justify each choice briefly in a comment or in `README.md`.
6. **Commit messages** should reference the phase, e.g. `feat(phase-4): dashboard map with hover tooltip`.

---

## Phase 0 — Backend Verification (BLOCKING)

Audit the existing backend against the frontend requirements before touching frontend code.

### Tasks

1. **Inventory endpoints.** Scan the backend source. List every route with method, params, response shape, and auth requirement. Write findings to `API_CONTRACT.md`.
2. **Build a requirements → endpoint matrix.** For each frontend data need below, mark `EXISTS`, `PARTIAL`, or `MISSING`:

   | #   | Frontend need                                             | Status | Endpoint |
   | --- | --------------------------------------------------------- | ------ | -------- |
   | 1   | Role-based login; returns role + session/token            |        |          |
   | 2   | List plants scoped to the current user                    |        |          |
   | 3   | Live weather by plant location                            |        |          |
   | 4   | Real-time power generation per plant                      |        |          |
   | 5   | Next-24hr generation forecast                             |        |          |
   | 6   | Underperformance reason/classification                    |        |          |
   | 7   | Alerts list with priority filter                          |        |          |
   | 8   | Cron AI prediction + classification (lower/higher/usual)  |        |          |
   | 9   | Notification/email trigger on high alert / sensor failure |        |          |
   | 10  | Historical forecast vs. actual generation (date-range)    |        |          |
   | 11  | Prediction confidence over time                           |        |          |
   | 12  | AI recommendations / notice board                         |        |          |
   | 13  | AI chatbot scoped to selected plant                       |        |          |

3. **Fix gaps.** For every `PARTIAL` or `MISSING` row, implement the required change (new endpoint, added response fields, new query params, schema update). Keep changes minimal and consistent with existing backend conventions.
4. **Finalize `API_CONTRACT.md`** so it documents all 13 needs with concrete, working endpoints.

### Checkpoint (Phase 0)

- All 13 rows read `EXISTS`.
- Each documented endpoint is manually verifiable (curl/Postman or a quick test) and returns the expected shape.
- `API_CONTRACT.md` and `ASSUMPTIONS.md` committed.

---

## Phase 1 — Scaffold `fluxcast-frontend`

### Tasks

1. Scaffold with Vite:
   ```bash
   npm create vite@latest fluxcast-frontend -- --template react
   cd fluxcast-frontend
   npm install
   ```
2. Install core deps:
   ```bash
   npm install react-router-dom @tanstack/react-query axios zustand date-fns lucide-react
   ```
3. Install + configure Tailwind CSS (per current Tailwind Vite setup). Define design tokens in the config: colors for alert severity (high/med/low) and generation status (lower/usual/higher).
4. Choose and install **map** and **chart** libraries based on need:
   - Map must support: zoom-to-plant, custom markers, hover popups, a weather overlay. (e.g. `react-leaflet` + `leaflet`, or Mapbox GL — pick one, note why.)
   - Charts must support: time-series, forecast-vs-actual, and a confidence band. (e.g. `recharts` or `react-chartjs-2` — pick one, note why.)
5. Create the folder structure:
   ```
   src/
     api/          # axios instance + one file per resource
     components/   # shared UI: Card, Sidebar, AlertItem, MapMarker, ChatBox...
     features/
       auth/
       plants/
       dashboard/
       history/
       decisions/
     hooks/        # React Query hooks: usePlants, useAlerts, useForecast...
     layouts/      # DashboardLayout (sidebar + outlet)
     routes/       # route config + ProtectedRoute wrapper
     store/        # Zustand: auth/role, selectedPlant
     utils/
   ```
6. Configure the **Axios instance** (`src/api/client.js`): base URL from env, auth-token request interceptor, response error handling / refresh.
7. Configure the **React Query client**: sensible `staleTime`/`retry` defaults; document polling intervals for real-time widgets (generation, alerts, AI card).
8. Add `.env` handling (`VITE_API_BASE_URL`, map token if needed) and a `.env.example`.

### Checkpoint (Phase 1)

- `npm run dev` boots with a blank routed shell and no console errors.
- Tailwind classes render. Axios + React Query providers wired at app root.

---

## Phase 2 — Auth & Routing

### Tasks

1. Build the **Auth page**: three role cards (use real role names from Phase 0; if unknown, assume Admin/Operator/Viewer and log in `ASSUMPTIONS.md`).
2. On login → call auth endpoint → store token + role in Zustand (persisted).
3. Implement `ProtectedRoute`: redirect unauthenticated users to `/auth`; add role guards if the contract requires them.
4. Define routes:
   ```
   /auth
   /plants
   /plants/:plantId/dashboard
   /plants/:plantId/history
   /plants/:plantId/decisions
   ```

### Checkpoint (Phase 2)

- Logging in stores session and lands on `/plants`.
- Hitting a protected route while logged out redirects to `/auth`.

---

## Phase 3 — Plant Selection

### Tasks

1. `usePlants()` React Query hook → fetch plants scoped to the user.
2. Render plant cards/list. On select: set `selectedPlant` in store and navigate to `/plants/:plantId/dashboard`.
3. Handle loading, empty ("no plants assigned"), and error states.

### Checkpoint (Phase 3)

- List reflects the authenticated user's accessible plants; selecting one routes to its dashboard.

---

## Phase 4 — Dashboard (highest complexity)

Build in this sub-order: **layout → map → alerts → AI card.**

### Tasks

1. **`DashboardLayout`**: persistent left sidebar (links to dashboard/history/decisions) + main content outlet.
2. **Central map:**
   - Zoomed-in, centered on the plant's coordinates.
   - Weather overlay reflecting current condition (color/icon) from the weather endpoint.
   - Plant marker with a **hover tooltip** showing: current generation, next-24hr prediction, and — if generation is below expected — the reason(s) from the underperformance endpoint.
   - Drive tooltip data with React Query, polled at the interval defined in Phase 1.
3. **Alerts panel (right):**
   - List with a priority filter (All / High / Medium / Low — match contract levels).
   - Near-real-time via polling or WebSocket per the contract.
4. **AI Decisions card (right-bottom):**
   - Fetch latest cron-generated prediction + classification (lower/higher/usual).
   - Poll at the cron cadence.
   - Surface high-alert / sensor-failure notices tied to the notification service. Confirm from Phase 0 whether email-sending is backend-only (display-only here) or needs a frontend trigger/ack — implement accordingly.

### Checkpoint (Phase 4)

- Map renders centered on the selected plant with weather styling.
- Hover shows generation + forecast, and reasons when underperforming.
- Alerts filter works; AI card shows current classification.

---

## Phase 5 — Plant History

### Tasks

1. Date-range picker driving all history queries.
2. **Forecast vs. actual** chart (line/area) with a clear caption describing what it shows.
3. **Confidence** chart — separate visual showing prediction confidence over time (line or shaded band).
4. Fetch all series via React Query, cached per date range.

### Checkpoint (Phase 5)

- Changing the date range refetches and redraws both charts; every chart has a caption.

---

## Phase 6 — Decisions & Chatbot

### Tasks

1. **AI Notice Board:** cards/list of AI recommendations (e.g., steps to avoid curtailment/outages), fetched via React Query.
2. **AI Chatbot:** chat UI scoped to the selected plant; sends plant ID + query to the chatbot endpoint. Support streaming (SSE/WebSocket) if the backend allows; otherwise request/response.

### Checkpoint (Phase 6)

- Notice board lists AI recommendations; chatbot answers plant-scoped queries.

---

## Phase 7 — Polish & Cross-Cutting

### Tasks

1. Loading/skeleton states for all async views (`isLoading`).
2. Error boundaries + retry UI on failed queries.
3. Responsive pass (Tailwind breakpoints): sidebar, map, alerts, charts on smaller screens.
4. Review real-time strategy: confirm polling vs. WebSocket for generation, alerts, AI card.
5. Accessibility pass: text descriptions for map/charts, keyboard nav for sidebar.
6. Update `README.md`: setup, env vars, scripts, library choices + rationale.

### Checkpoint (Phase 7)

- `npm run build` succeeds; app is responsive; no unhandled loading/error gaps.

---

## Definition of Done

- All 7 phases complete with checkpoints passed.
- `API_CONTRACT.md`, `ASSUMPTIONS.md`, and `README.md` are current.
- Frontend runs end-to-end against the verified backend with no mocked data.
