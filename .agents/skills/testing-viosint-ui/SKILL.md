# Testing VIOSINT Frontend UI

## Overview
This skill covers how to set up and test the VIOSINT frontend UI locally, verify CSS styling changes, and navigate through all operator views.

## Environment Setup

### 1. PostgreSQL Database
The backend requires PostgreSQL. The default config is in `backend/app/core/config.py`.
- Database name, user, and password are defined there as defaults.
- If PostgreSQL auth fails, check `config.py` for the expected credentials and update the DB user password to match.

Example fix (replace placeholder with value from config.py):
```bash
sudo -u postgres psql -c "ALTER USER <DB_USER> WITH PASSWORD '<DB_PASSWORD>';"
```

If the user/database doesn't exist:
```bash
sudo -u postgres psql -c "CREATE USER <DB_USER> WITH PASSWORD '<DB_PASSWORD>';"
sudo -u postgres psql -c "CREATE DATABASE <DB_NAME> OWNER <DB_USER>;"
```

### 2. Redis
Redis should be running on default port 6379. Start with:
```bash
sudo service redis-server start
```

### 3. Neo4j (Optional)
Neo4j is optional — the backend gracefully degrades without it. If not available, graph-related features won't work but all other features will.

### 4. Backend
```bash
cd backend
PYTHONPATH=. poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Run in a background shell. Wait for "Application startup complete" before proceeding.

### 5. Frontend
```bash
cd frontend
npm run dev
```
Run in a separate background shell. Wait for "Ready" message.

### 6. Seed Demo Data
```bash
curl -X POST http://localhost:8000/api/v1/seed/demo
```
This creates: 25 entities, 625+ temporal events, 30 alerts, 5 cases with evidence/notes.

Verify with:
```bash
curl http://localhost:8000/api/v1/seed/status
```

## Testing UI Views

The app has these main views accessible via header tabs:
- **DASH** — General dashboard (uses older Dashboard.tsx, not part of redesigned operator views)
- **OPS** — Operator Console with alerts, watchlist, live feed
- **CASES** — Case management with status filters
- **INVEST** — Investigation search (type a query and click SEARCH to load entities, then click an entity for profile)
- **INTEL** — Intelligence view with risk/behavior distributions, trends, insights

### Key Testing Notes
- The **INVEST** view requires typing a search query (e.g., "Male") and clicking SEARCH before entities appear
- The **OPS** live feed shows temporal events with colored badges (APP, DEP, CO_, etc.)
- The **CASES** view shows seeded cases with status colors (open/active/closed)
- Entity profiles appear in the right panel of INVEST view when you click an entity row

## Programmatic CSS Verification

Use browser console to verify exact computed CSS values:

```javascript
// Background color
console.log('BG:', getComputedStyle(document.body).backgroundColor);

// Active tab color (should be accent color)
const activeTab = document.querySelector('button[class*="text-intel-accent"]');
console.log('TAB_COLOR:', activeTab ? getComputedStyle(activeTab).color : 'NOT FOUND');

// Event badges
const badges = document.querySelectorAll('[class*="evt-"]');
badges.forEach((b, i) => {
  if (i < 5) console.log(`BADGE_${i}:`, b.textContent.trim(), getComputedStyle(b).color, getComputedStyle(b).backgroundColor);
});

// Timestamps
const timestamps = document.querySelectorAll('[class*="text-gray-400"][class*="font-medium"]');
console.log('TIMESTAMPS:', timestamps.length);

// WATCH button
const watchBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'WATCH');
console.log('WATCH_COLOR:', watchBtn ? getComputedStyle(watchBtn).color : 'NOT FOUND');
```

## Design System Reference

Current palette (as of matte refinement):
- **Primary background**: `#121416` (charcoal grey) → `rgb(18, 20, 22)`
- **Accent color**: `#d4956a` (powder orange) → `rgb(212, 149, 106)`
- **Severity colors** (matte): critical=#c75050, high=#d97736, medium=#c9a74e, low=#6b7280
- **Event badge colors**: alert=#c75050, movement=#4a9e7a, transaction=#5b8ec9, detection=#5aa0a0, appearance=#8b6db5, system=#7d8189

All defined in `frontend/tailwind.config.ts` under `colors.intel`, `colors.sev`, and `colors.evt`.

## Devin Secrets Needed
No external secrets required. Database credentials are defined as defaults in `backend/app/core/config.py`.
