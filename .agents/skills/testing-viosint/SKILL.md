# Testing VIOSINT Platform

## Local Environment Setup

### Prerequisites
- PostgreSQL (install via `sudo apt-get install -y postgresql postgresql-contrib`)
- Redis (install via `sudo apt-get install -y redis-server`)
- Neo4j is optional — the backend gracefully degrades without it
- Python 3.11+ with Poetry
- Node.js 18+ with npm

### Database Setup
```bash
sudo service postgresql start
sudo -u postgres psql -c "CREATE ROLE viosint WITH LOGIN PASSWORD '<VIOSINT_DB_PASSWORD>';"
sudo -u postgres psql -c "CREATE DATABASE viosint OWNER viosint;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE viosint TO viosint;"
sudo service redis-server start
```

### Backend Startup
```bash
cd backend
poetry install
# scikit-learn may need manual install if not in pyproject.toml:
poetry run pip install scikit-learn
# Start with intelligence engine on PYTHONPATH:
PYTHONPATH=/path/to/repo/services/intelligence-engine:$PYTHONPATH poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000
```
- Backend runs on http://localhost:8000
- Health check: `curl http://localhost:8000/health`
- API prefix: `/api/v1`

### Frontend Startup
```bash
cd frontend
npm install
npm run dev
```
- Frontend runs on http://localhost:3000
- Connects to backend at http://localhost:8000 by default

## Testing Workflows

### Case Management Testing
1. Navigate to Cases page via header nav
2. Click "New Case" → fill modal (title, description, priority, severity) → Create
3. Case detail view has 6 tabs: Timeline, Evidence, Entities, Notes, Summary, Audit
4. Add notes via Notes tab (text area + type selector + Add Note button)
5. Change status via dropdown (Open/Active/Closed)
6. Navigate back via back arrow to verify case list updates

### API Validation
```bash
# List cases
curl http://localhost:8000/api/v1/cases
# Get case detail
curl http://localhost:8000/api/v1/cases/{id}
# Get notes
curl http://localhost:8000/api/v1/cases/{id}/notes
# Get timeline
curl http://localhost:8000/api/v1/cases/{id}/timeline
# Get audit log
curl http://localhost:8000/api/v1/cases/{id}/audit
# Generate summary
curl -X POST http://localhost:8000/api/v1/cases/{id}/summary
```

### Alert-to-Case Flow
- Operator Dashboard shows briefcase icon on each alert card
- Requires live alert data in the database to test
- Database starts empty — may need to seed alerts via API to test this flow

## Known Issues & Workarounds
- Backend requires `scikit-learn` for the intelligence engine's anomaly detector, but it might not be listed in `pyproject.toml`. Install manually if import fails.
- Neo4j connection failure is non-blocking — backend logs a warning and continues.
- Redis connection failure is non-blocking — backend logs a warning and continues.
- The "Create Case" button uses a click handler that may timeout with automated tools; using coordinate-based clicks can be a workaround.
- When running `sudo` commands for PostgreSQL, "Permission denied" warnings about `/home/ubuntu` are cosmetic and can be ignored.

## Devin Secrets Needed
- `VIOSINT_DB_PASSWORD`: PostgreSQL password for the `viosint` database user
