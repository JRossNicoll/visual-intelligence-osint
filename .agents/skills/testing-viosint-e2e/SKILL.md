# VIOSINT E2E Testing

## Overview
End-to-end testing of the VIOSINT visual intelligence platform — a Next.js 14 frontend + FastAPI backend + Docker infrastructure (Postgres, Redis, Neo4j, CV Pipeline).

## Devin Secrets Needed
No secrets required. The app uses local Docker services with default credentials defined in `.env.example`.

## Infrastructure Setup

1. Copy `.env.example` to `.env` if not already present
2. Start Docker services:
   ```bash
   cd /path/to/visual-intelligence-osint
   docker compose up -d postgres redis neo4j
   ```
3. Wait for all containers to be healthy:
   ```bash
   docker compose ps  # all should show "healthy" or "running"
   ```
4. Start the backend (can run in Docker or directly):
   ```bash
   docker compose up -d backend
   # OR run directly with uvicorn if Docker has issues
   ```
5. Verify backend health:
   ```bash
   curl http://localhost:8000/health
   ```
6. Start the frontend:
   ```bash
   cd frontend
   NEXT_PUBLIC_API_URL=http://localhost:8000 NEXT_PUBLIC_WS_URL=ws://localhost:8000 npm run dev
   ```

### Common Infrastructure Issues
- **Port 3000 in use**: Kill old Next.js processes with `pkill -f 'next dev'` or `lsof -ti:3000 | xargs kill -9`
- **CV Pipeline build failures**: The `lap` package (v0.4.0) may be incompatible with numpy 2.x. Use `lapx>=0.5.2` instead.
- **libgl1-mesa-glx not found**: On Debian trixie+, use `libgl1` instead of `libgl1-mesa-glx` in Dockerfiles.

## Key Test Flows

### 1. Video Upload Flow (Primary)
- Navigate to Streams > Add Stream
- The form has 3 source tabs: Upload File, RTSP Stream, WebRTC
- The file input is hidden (`className="hidden"`) — use the drop zone click or expose it via JS console
- To expose the hidden file input for automation:
  ```js
  const input = document.querySelector('input[type="file"]');
  input.removeAttribute('devin-hidden');
  input.classList.remove('hidden');
  input.style.display = 'block';
  ```
- Upload a test video (create one with ffmpeg if needed):
  ```bash
  ffmpeg -f lavfi -i testsrc=duration=3:size=320x240:rate=15 -c:v libx264 -pix_fmt yuv420p /tmp/test-video.mp4
  ```
- Verify: stream appears with ACTIVE badge, LIVE indicator, FILE source type
- Verify: Dashboard Active_Streams counter increments

### 2. Sidebar Collapse/Expand
- Click the "Collapse" button at bottom of sidebar
- Verify: sidebar shrinks to icon-only rail (~56px wide)
- Verify: nav items show tooltip titles on hover
- Click expand button to restore full sidebar with labels

### 3. Command Palette (Ctrl+K)
- Press Ctrl+K to open
- Verify: overlay appears with "search --cmd" placeholder
- Type to filter — results update in real-time
- Click or press Enter to navigate to selected view
- Press Esc to close

### 4. Stream Deletion + Dashboard Update
- Delete a stream from the Streams view
- Navigate to Dashboard
- Verify Active_Streams counter decremented

### 5. Upload Button Validation
- Open Add Stream form without selecting a file
- Verify "Upload & Analyze" button has `disabled="true"`
- Select a file — button should become enabled

## Frontend-Backend Contract Notes
- Backend only accepts video MIME types: `video/mp4`, `video/avi`, `video/x-msvideo`, `video/quicktime`, `video/webm`
- Frontend file input should use `accept="video/*"` (not `video/*,image/*`)
- Reference image endpoint uses hyphens: `/targets/{id}/reference-image` (not underscore)
- API prefix is `/api/v1`
- WebSocket connection status shown in footer as `WS:CONNECTED` (green) or `WS:DISCONNECTED`
- Backend health check: `GET /health`

## Verification Checklist
- [ ] All Docker services healthy (postgres, redis, neo4j, backend)
- [ ] Frontend shows WS:CONNECTED and LINK:OK
- [ ] Video upload creates stream with ACTIVE status
- [ ] Dashboard counters update after stream create/delete
- [ ] Sidebar collapse/expand works
- [ ] Command Palette opens, filters, and navigates
- [ ] Upload button disabled until file selected
