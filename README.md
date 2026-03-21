# VIOSINT - Visual Intelligence OSINT Platform

A production-grade, real-time visual intelligence system that ingests live or recorded video streams, performs persistent object detection and tracking, builds relationship graphs, and delivers actionable intelligence through a real-time UI.

> "Sees. Tracks. Remembers. Connects. Alerts."

---

## Architecture Overview

```
                    ┌─────────────┐
                    │   Nginx     │  Port 80/443
                    │   Reverse   │  Rate limiting, SSL termination,
                    │   Proxy     │  static file serving
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     ┌────────▼──────┐ ┌──▼───┐ ┌──────▼──────┐
     │   Frontend    │ │  WS  │ │  REST API   │
     │   Next.js     │ │      │ │  /api/v1/*  │
     │   Port 3000   │ │      │ │             │
     └───────────────┘ └──┬───┘ └──────┬──────┘
                          │            │
                    ┌─────▼────────────▼─────┐
                    │    Backend (FastAPI)    │
                    │    Port 8000           │
                    │                        │
                    │  • Stream Management   │
                    │  • Entity Intelligence │
                    │  • Target Matching     │
                    │  • Alert System        │
                    │  • WebSocket Hub       │
                    └───┬──────┬──────┬──────┘
                        │      │      │
              ┌─────────▼┐ ┌──▼───┐ ┌▼──────────┐
              │PostgreSQL │ │Redis │ │   Neo4j   │
              │ Metadata  │ │Cache │ │   Graph   │
              │ Port 5432 │ │6379  │ │ Port 7687 │
              └──────────┘ └──────┘ └───────────┘
                        │
                        │ Frame results via HTTP
                        │
                ┌───────▼────────────┐
                │  CV Pipeline       │
                │  Port 8001         │
                │                    │
                │  • YOLOv8 Detect   │
                │  • ByteTrack       │
                │  • CLIP Embeddings │
                │  • Attribute Ext.  │
                └────────────────────┘
                        │
                   Video Sources
              (RTSP / Files / WebRTC)
```

### Microservices Breakdown

| Service | Technology | Purpose |
|---------|-----------|---------|
| **Backend API** | FastAPI (Python) | REST API, WebSocket hub, business logic, data orchestration |
| **CV Pipeline** | Python + PyTorch | Object detection, tracking, embedding generation, attribute extraction |
| **Frontend** | Next.js + TailwindCSS | Real-time intelligence UI with detection overlays |
| **PostgreSQL** | PostgreSQL 16 | Relational metadata (streams, entities, detections, targets, alerts) |
| **Neo4j** | Neo4j 5 Community | Relationship graph (entity connections, co-occurrences, locations) |
| **Redis** | Redis 7 | Real-time state, pub/sub for WebSocket broadcasting, caching |
| **Nginx** | Nginx Alpine | Reverse proxy, rate limiting, security headers, static files |

---

## Features

### Core Intelligence Capabilities

- **Real-time Object Detection**: YOLOv8-based detection running at 10+ FPS target
- **Multi-Object Tracking**: ByteTrack algorithm with persistent track IDs within sessions
- **Cross-Session Identity Matching**: CLIP embeddings for matching objects across different videos and times
- **Custom Target Definition**: Text-based targets ("white Toyota Hilux", "person wearing red hoodie") matched via CLIP embeddings
- **Relationship Graph**: Neo4j-powered graph connecting entities, locations, and temporal data
- **Attribute Extraction**: Automated color detection, vehicle type classification, clothing analysis
- **Real-time Alerting**: Target match alerts, reappearance notifications with optional webhook delivery

### Frontend Features

- **Live Feed View**: Real-time video streams with detection bounding boxes, tracking IDs, and attribute labels
- **Dashboard**: Overview stats, recent alerts, active streams, detected entities
- **Stream Management**: Add/remove RTSP streams, uploaded videos, WebRTC sources
- **Target Definition UI**: Create custom intelligence targets with text descriptions and priority levels
- **Entity Browser**: Search, filter, and explore tracked entities with confidence scores and attributes
- **Entity Detail Panel**: Timeline, relationship graph, extracted attributes for each entity
- **Alert Management**: Filterable alert feed with severity levels, acknowledgment workflow
- **WebSocket Status**: Real-time connection indicator and live detection counts

### Technical Features

- **Horizontal Scaling**: Separate real-time (WebSocket/streaming) and batch (embedding/matching) workloads
- **GPU Support**: NVIDIA CUDA support via dedicated GPU Dockerfile
- **Production Docker Compose**: Multi-stage builds, health checks, resource limits
- **Rate Limiting**: Nginx-level rate limiting for API, WebSocket, and upload endpoints
- **Security Headers**: CSP, X-Frame-Options, XSS protection via Nginx

---

## Quick Start

### Prerequisites

- Docker & Docker Compose v2+
- 8GB+ RAM recommended
- (Optional) NVIDIA GPU + NVIDIA Container Toolkit for GPU acceleration

### 1. Clone and Configure

```bash
git clone https://github.com/JRossNicoll/visual-intelligence-osint.git
cd visual-intelligence-osint
cp .env.example .env
# Edit .env with your settings (defaults work for development)
```

### 2. Start All Services

```bash
# Development (CPU mode)
docker compose up -d

# With GPU acceleration
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d

# Production mode
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 3. Access the Platform

| Interface | URL |
|-----------|-----|
| **Frontend UI** | http://localhost:3000 |
| **API Documentation** | http://localhost:8000/docs |
| **API (ReDoc)** | http://localhost:8000/redoc |
| **Neo4j Browser** | http://localhost:7474 |
| **Via Nginx (Production)** | http://localhost |

### 4. Verify Services

```bash
# Health check
curl http://localhost:8000/health

# Detailed health (all dependencies)
curl http://localhost:8000/health/detailed
```

---

## Development Setup

### Backend (FastAPI)

```bash
cd backend
pip install poetry
poetry install
# Start dev server with auto-reload
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### CV Pipeline

```bash
cd services/cv-pipeline
pip install poetry
poetry install
# Start pipeline service
poetry run uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:3000
```

### Required Infrastructure (for local dev)

```bash
# Start just databases
docker compose up -d postgres redis neo4j
```

---

## API Reference

### Streams

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/streams` | Create a new video stream |
| `GET` | `/api/v1/streams` | List all streams |
| `GET` | `/api/v1/streams/{id}` | Get stream details |
| `PATCH` | `/api/v1/streams/{id}` | Update stream |
| `DELETE` | `/api/v1/streams/{id}` | Delete stream |
| `POST` | `/api/v1/streams/{id}/start` | Start processing |
| `POST` | `/api/v1/streams/{id}/stop` | Stop processing |
| `GET` | `/api/v1/streams/{id}/status` | Real-time status |
| `POST` | `/api/v1/streams/{id}/upload` | Upload video file |

### Entities

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/entities` | Search/list entities |
| `GET` | `/api/v1/entities/{id}` | Get entity details |
| `GET` | `/api/v1/entities/{id}/detections` | Entity's detections |
| `GET` | `/api/v1/entities/{id}/graph` | Relationship graph |
| `GET` | `/api/v1/entities/{id}/timeline` | Sighting timeline |

### Targets

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/targets` | Create intelligence target |
| `GET` | `/api/v1/targets` | List targets |
| `GET` | `/api/v1/targets/{id}` | Get target details |
| `PATCH` | `/api/v1/targets/{id}` | Update target |
| `DELETE` | `/api/v1/targets/{id}` | Delete target |
| `POST` | `/api/v1/targets/{id}/reference-image` | Upload reference image |

### Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/alerts` | List alerts (filterable) |
| `GET` | `/api/v1/alerts/unread-count` | Get unread count |
| `GET` | `/api/v1/alerts/{id}` | Get alert details |
| `POST` | `/api/v1/alerts/{id}/read` | Mark as read |
| `POST` | `/api/v1/alerts/{id}/acknowledge` | Acknowledge alert |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `ws://host/ws` | General real-time updates |
| `ws://host/ws/stream/{id}` | Stream-specific detections |
| `ws://host/ws/alerts` | Alert notifications |

### Pipeline (Internal)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/pipeline/frame-result` | Receive CV pipeline results |
| `POST` | `/api/v1/pipeline/stats` | Pipeline statistics |

---

## Data Schemas

### PostgreSQL Tables

```
streams          - Video source configuration and status
entities         - Tracked objects with persistent identity
detections       - Individual frame-level detections
sightings        - Aggregated entity appearances per stream
targets          - User-defined intelligence targets
alerts           - Generated intelligence alerts
```

### Neo4j Graph Schema

```
Nodes:
  (:Entity {entity_id, label, entity_type, confidence, ...})
  (:Location {name, latitude, longitude, ...})

Relationships:
  (:Entity)-[:SEEN_AT {stream_id, first_seen, last_seen, count}]->(:Location)
  (:Entity)-[:CO_OCCURRED_WITH {stream_id, timestamp, count}]->(:Entity)
```

### Redis Keys

```
stream:{id}:status     - Real-time stream status JSON
entity:{id}:embedding  - Cached entity embeddings
target:{id}:config     - Active target configuration cache
pipeline:stats:{id}    - Pipeline performance metrics
channel:detections     - Pub/sub for real-time detections
channel:alerts         - Pub/sub for alert notifications
```

---

## Scaling Considerations

### Horizontal Scaling Strategy

1. **Backend API**: Stateless, scale via Docker replicas behind Nginx load balancer
2. **CV Pipeline**: CPU/GPU bound, scale with dedicated GPU nodes per stream
3. **Frontend**: Stateless Next.js, scale via replicas
4. **PostgreSQL**: Read replicas for query-heavy entity search
5. **Redis**: Cluster mode for pub/sub scaling across multiple backend instances
6. **Neo4j**: Causal clustering for read-heavy graph queries

### Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Detection FPS | >= 10 FPS | Per stream, YOLOv8 nano on GPU |
| API Latency (P99) | < 200ms | For entity search/list |
| WebSocket Latency | < 100ms | Frame detection to UI |
| Concurrent Streams | 4 (CPU) / 16 (GPU) | Per CV pipeline instance |
| Entity Matching | < 500ms | CLIP embedding similarity |

### Resource Requirements

| Environment | CPU | RAM | GPU | Storage |
|------------|-----|-----|-----|---------|
| Development | 4 cores | 8 GB | None | 20 GB |
| Production (small) | 8 cores | 16 GB | 1x T4 | 100 GB |
| Production (large) | 16+ cores | 32+ GB | 2x A100 | 500+ GB |

---

## Technology Choices & Justification

| Technology | Choice | Justification |
|-----------|--------|---------------|
| **Detection** | YOLOv8 | Best speed/accuracy tradeoff, actively maintained, easy model swapping |
| **Tracking** | ByteTrack | Handles occlusions better than DeepSORT, lower compute overhead |
| **Embeddings** | OpenCLIP (ViT-B-32) | Cross-modal (image+text), enables text-based target matching |
| **Backend** | FastAPI | Async support, auto-docs, WebSocket native, Python ML ecosystem |
| **Graph DB** | Neo4j | Industry standard for relationship queries, APOC procedures |
| **Cache** | Redis | Pub/sub for real-time, fast embedding cache, stream state |
| **Frontend** | Next.js | SSR capability, React ecosystem, production-ready |
| **Proxy** | Nginx | Battle-tested, WebSocket support, rate limiting |

---

## Project Structure

```
visual-intelligence-osint/
├── backend/                    # FastAPI backend service
│   ├── app/
│   │   ├── api/
│   │   │   └── endpoints/     # REST + WebSocket endpoints
│   │   ├── core/              # Config, security, lifecycle
│   │   ├── db/                # Database connectors (PG, Redis, Neo4j)
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   └── services/          # Business logic layer
│   ├── Dockerfile
│   └── pyproject.toml
├── services/
│   └── cv-pipeline/           # Computer Vision pipeline
│       ├── pipeline/
│       │   ├── detection/     # YOLOv8 detector
│       │   ├── tracking/      # ByteTrack tracker
│       │   ├── embedding/     # CLIP embedder
│       │   └── extraction/    # Attribute extractor
│       ├── main.py            # Pipeline API server
│       ├── Dockerfile
│       └── Dockerfile.gpu
├── frontend/                  # Next.js frontend
│   ├── src/
│   │   ├── app/              # Next.js app router
│   │   ├── components/       # React components
│   │   ├── lib/              # API client, WebSocket, utilities
│   │   └── types/            # TypeScript type definitions
│   └── Dockerfile
├── infra/
│   ├── nginx/                # Nginx reverse proxy config
│   └── init-db.sql           # PostgreSQL initialization
├── docker-compose.yml         # Development orchestration
├── docker-compose.gpu.yml     # GPU override
├── docker-compose.prod.yml    # Production override
├── .env.example               # Environment template
└── README.md
```

---

## License

This project is proprietary software. All rights reserved.
