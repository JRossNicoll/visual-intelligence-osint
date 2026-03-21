# VIOSINT Platform — Testing Skill

## Overview
The VIOSINT platform is a Visual Intelligence OSINT system with a FastAPI backend and Next.js frontend. Testing involves starting infrastructure services, seeding demo data, and navigating through multiple operator views.

## Devin Secrets Needed
- No secrets required for local testing. PostgreSQL uses default credentials (user=viosint, password=viosint_dev_password, db=viosint).

## Environment Setup

### 1. Start PostgreSQL and Redis
```bash
sudo service postgresql start
sudo service redis-server start
```

### 2. Verify PostgreSQL Database
The database `viosint` with user `viosint` should exist. If not:
```bash
sudo -u postgres psql -c "CREATE USER viosint WITH PASSWORD 'viosint_dev_password';"
sudo -u postgres psql -c "CREATE DATABASE viosint OWNER viosint;"
```

### 3. Start Backend
```bash
cd backend
POSTGRES_PASSWORD=viosint_dev_password DEMO_MODE=true poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000
```
- `DEMO_MODE=true` triggers auto-seeding on first startup
- Backend runs on http://localhost:8000
- Neo4j is optional — the app gracefully degrades without it

### 4. Seed Demo Data
If DEMO_MODE didn't auto-seed, manually seed:
```bash
curl -X POST http://localhost:8000/api/v1/seed/demo
```
Expected: 25 entities, 30 alerts, 5 cases, 625+ temporal events, 25 entity profiles, 12 insights.

Verify with:
```bash
curl http://localhost:8000/api/v1/seed/status
```

### 5. Start Frontend
```bash
cd frontend
npm run dev
```
- Frontend runs on http://localhost:3000
- If `npm install` is needed first, run it before `npm run dev`

## UI Navigation

The app has a single-page layout with tab navigation in the header:

| Tab | View | Key Content |
|-----|------|-------------|
| DASH | Dashboard | Stat cards, recent alerts, active streams, recent entities |
| OPS | Operator Console | Active alerts with severity, watchlist, live feed |
| CASES | Case Management | Case list with status/priority filters |
| INVEST | Investigation | Entity search with risk/type filters, entity profiles |
| INTEL | Intelligence | Risk/behavior distributions, trends, top entities, insights |

### Clicking Into Case Detail
- From CASES tab, click a case row to open CaseDetailView
- Case rows may need coordinate-based clicks if devinid clicks timeout
- CaseDetailView has 6 tabs: Timeline, Evidence, Entities, Notes, Summary, Audit

### Clicking Into Entity Profile
- From INVEST tab, search (e.g. type "male" and click SEARCH) to populate entity list
- Click an entity row to load its profile in the right panel
- Empty search query may return no results — always provide a search term
- The Investigation view shows entity profile inline (not a separate page)
- The full EntityProfileView is accessed from within the investigation panel

## Testing Tips

- **Alert severity colors**: Critical=red (#ef4444), High=orange (#f97316), Medium=yellow (#eab308), Low=gray-blue (#64748b)
- **Panel styling**: All redesigned panels use `bg-intel-panel` background, `border-intel-border` borders, `rounded-sm` (2px)
- **Typography**: Base font is Inter at 13px, with `text-2xs` (10px) for labels
- **The Dashboard (DASH) tab** is an older unredesigned component — focus testing on OPS, CASES, INVEST, INTEL tabs
- **Case row clicks** may timeout with devinid — use coordinate-based clicks as fallback
- **Backend health check**: `curl http://localhost:8000/health/status` returns service health + data counts

## Lint Checks
```bash
cd frontend && npm run lint
```
Note: Pre-existing lint errors may exist in unmodified files (AlertsView, Dashboard, EntitiesView, GraphExplorer, LiveFeedView, etc.) — these are outside scope of UI redesign work.

## Common Issues
- If backend fails to start, check PostgreSQL is running and the `viosint` database exists
- If frontend shows connection errors, ensure backend is running on port 8000 first
- If demo data is missing, manually trigger seeding via the seed API endpoint
- Neo4j not being available is normal for local testing — the app handles this gracefully
