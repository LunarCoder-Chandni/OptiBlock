# OptiBlock

AI-powered railway block-planning prototype — built for **SIH 2026, Problem Statement 26027**
("AI-Powered Automatic Block Planning to Maximize Asset Availability for Train Operations on
Indian Railways", Ministry of Railways).

OptiBlock takes pending maintenance **block requests** from four departments (Track/Engineering,
Signal & Telecom, TRD/OHE, Traffic/Operations), scores them by priority and risk, fuses compatible
requests into shared possessions, and schedules every request into the lowest-disruption time
window on a synthetic weekly corridor timetable — instead of each department booking blind and
independently, which is today's problem.

## What's actually running

```
Browser (dashboard)  ──fetch──▶  Flask REST API  ──▶  optimizer.py (pure Python)
   templates/index.html            app.py              priority scoring · fusion pass
   static/css, static/js                                greedy constrained scheduler
                                                          siloed-baseline comparison
```

- **Frontend**: a single dashboard (`templates/index.html` + `static/js/app.js`) with four tabs —
  Overview, Block Requests, AI Schedule (a weekly Gantt view with a live traffic heatmap), and a
  Conflict Center. Every block is clickable and shows *why* the engine put it there.
- **Backend**: Flask (`app.py`) exposing a small REST API. All the "AI" — scoring, fusion,
  scheduling, conflict detection, the manual-baseline comparison — runs in `optimizer.py` and is
  fully deterministic and inspectable (no external ML service, no API keys required).
- **Data**: synthetic. A 5-section corridor (NDLS–GZB–ALJN–TDL–ETW–CNB) with a generated weekly
  train timetable (Rajdhani/Shatabdi, Superfast/Express, Passenger/MEMU, Freight) and 14 seed
  maintenance requests. This is stated on the dashboard itself — real operational data (BDMS/COA
  feeds) was not available for this prototype.

## Running it (Replit or locally)

```bash
pip install -r requirements.txt
python app.py
```

Then open the app (Replit will open it automatically; locally it's `http://127.0.0.1:5000`).

## API

| Method | Route                  | Purpose                                                             |
|--------|-------------------------|----------------------------------------------------------------------|
| GET    | `/`                     | Renders the dashboard                                               |
| GET    | `/api/meta`              | Corridor, stations, departments, train timetable, traffic matrix     |
| GET    | `/api/requests`           | Current pending block requests with computed priority score         |
| POST   | `/api/requests`           | Add a new block request `{dept, section, work, dur, urgency, crit, safety, pref}` |
| POST   | `/api/requests/reset`      | Reset requests back to the 14 seed examples                         |
| POST   | `/api/optimize`           | Runs the full pipeline; returns the AI plan, conflicts, baseline, and KPIs |

State is held in memory in `app.py` (`STATE`) — fine for a single demo session; see Roadmap below
for what changes if this needs to survive restarts or serve multiple concurrent users.

## The algorithm (`optimizer.py`)

1. **Priority score** per request = `4 × criticality + 3 × (10 − urgency_days) + 15 if safety-critical`.
2. **Fusion pass**: requests in the same section, both preferring night hours, from compatible
   departments (Track+S&T, Track+TRD, S&T+TRD), with combined duration ≤ 6h, are merged into one
   possession — this is the "combine compatible works" strategy that gives the biggest disruption
   reduction in real block planning.
3. **Greedy constrained scheduling**: highest-priority requests are placed first, each into the
   lowest traffic-cost window (read off an hourly train-density model for its section) that still
   lands before its deadline and doesn't clash with an already-booked window.
4. **Baseline comparison**: a second, deliberately naive scheduler books each original request at
   its department's earliest preferred slot on day one, with *no* visibility into what other
   departments booked — this reproduces today's siloed-planning problem and is what the dashboard
   compares the AI plan against.

## Why this scope, and not the full stack described in the project brief

The original project brief sketches a full production system — React + Vite, FastAPI, PostgreSQL,
JWT auth, OR-Tools, Docker, RBAC, audit logs, ML duration prediction, Leaflet maps. That's a
legitimate target architecture, but building all of it is a multi-month engineering effort, and
none of it is what actually gets judged in an SIH prototype demo. This build deliberately
implements the brief's own **Phase 1**: *"Rule-based conflict engine + optimization algorithm"*,
with a clean, real (not mocked) backend and a frontend good enough to demo and screenshot for the
PPT. Concretely:

- No database — in-memory state is enough for a demo session and removes a whole class of setup
  friction on Replit.
- No auth/RBAC — not needed to demonstrate the optimization logic itself.
- No OR-Tools/ML — the greedy constrained scheduler is real optimization logic (not an `if/else`
  stub), is fast, fully explainable, and easy to defend in a judge Q&A. OR-Tools (CP-SAT) is a
  reasonable upgrade once the constraint model is finalized (see Roadmap).
- Plain Flask instead of FastAPI/React — matches the Replit project you already had, and avoids a
  rewrite before the deadline.

## Roadmap (if you keep building after submission)

- **Phase 2**: PostgreSQL + SQLAlchemy models for `Train`, `Section`, `BlockRequest`, `Block`,
  matching section 10 of the original brief; swap `STATE` (in-memory dict) for real persistence.
- **Phase 3**: Replace/augment the greedy scheduler with Google OR-Tools CP-SAT for provably
  optimal (not just good) placements once you have a finalized constraint set; add an ML model to
  predict maintenance duration from historical data instead of using a fixed estimate.
- **Phase 4**: Auth (JWT), role-based views (Planner/Approver/Viewer), audit log on approvals, and
  a map view (Leaflet) alongside the existing Gantt view.

## Project structure

```
optiblock/
├── app.py              # Flask routes / REST API
├── optimizer.py         # scoring, fusion, scheduling, baseline, KPIs — pure Python
├── requirements.txt
├── templates/
│   └── index.html        # dashboard shell
└── static/
    ├── css/style.css      # design system
    └── js/app.js           # fetches the API and renders the dashboard
```
