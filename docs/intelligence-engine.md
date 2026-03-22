# Intelligence Engine Architecture

## Overview

The Intelligence Engine transforms the VIOSINT platform from a detection/tracking system into a reasoning engine that can detect patterns, predict behavior, and generate actionable insights. Every output is **statistically grounded** — no heuristics, no arbitrary thresholds.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  CV Pipeline     │────▶│  Event Processor │────▶│ Intelligence Engine│
│  (Detection)     │     │  (Redis Streams)  │     │  (Analysis)        │
└─────────────────┘     └──────────────────┘     └────────────────────┘
                                                          │
                                                          ▼
                                                  ┌────────────────┐
                                                  │  Backend API   │
                                                  │  (FastAPI)     │
                                                  └───────┬────────┘
                                                          │
                                                          ▼
                                                  ┌────────────────┐
                                                  │  Frontend UI   │
                                                  │  (Next.js)     │
                                                  └────────────────┘
```

## Analysis Modules

### 1. Temporal Pattern Analyzer

**Purpose:** Detect periodicity and time-based patterns in entity appearances.

**Methods:**
- **FFT (Fast Fourier Transform):** Applies Hann window, computes power spectrum, identifies dominant frequencies
- **Autocorrelation:** Normalized autocorrelation with peak finding to cross-validate FFT results
- **Cross-validation:** Both methods must agree within 20% to confirm periodicity
- **KDE (Kernel Density Estimation):** Models hour-of-day distribution for peak detection

**Output:**
- `has_periodicity`: Boolean (cross-validated)
- `dominant_period_hours`: Float (e.g., 24.0 for daily)
- `periodicity_confidence`: Float [0, 1]
- `peak_hours`: List of peak activity hours
- `peak_days`: List of peak activity days

### 2. Anomaly Detector

**Purpose:** Score events as anomalous relative to learned baseline behavior.

**Methods:**
- **Circular Z-score:** Uses sin/cos encoding for time-of-day (handles midnight wraparound)
- **Location Z-score:** Empirical probability with Laplace smoothing
- **Isolation Forest:** Scikit-learn IsolationForest on feature vectors
- **Composite Score:** `0.5 * z_normalized + 0.5 * isolation_score`

**Output:**
- `anomaly_score`: Float [0, 1]
- `is_anomalous`: Boolean
- `time_z_score`: Raw circular z-score
- `location_z_score`: Location deviation score
- `isolation_score`: IsolationForest anomaly score
- `explanation`: Human-readable reasoning

### 3. Behavior Modeler

**Purpose:** Classify entity behaviors using statistical tests.

| Behavior | Statistical Method | Threshold Logic |
|---|---|---|
| Loitering | Duration z-score | `duration > mean + 2*std` of all durations |
| Repeated Visits | Binomial test | `p-value < 0.05` for visit frequency |
| Convoy | Chi-squared test | Independence test for co-occurrence, `p-value < 0.05` |
| Stay Duration | Percentile classification | Short (<25th), Normal (25-75th), Long (>75th), Extended (>95th) |
| Routine | Coefficient of Variation | `CV < 0.3` = highly routine |

### 4. Relationship Engine

**Purpose:** Compute weighted relationship strength between entities.

**Formula:**
```
W = α * freq_component + β * proximity_component + γ * consistency_component
```
Default weights: α=0.4, β=0.3, γ=0.3

**Decay Function:**
```
weight(t) = exp(-λ * Δt)
```
Where λ = 0.01 (half-life ≈ 69 hours)

**Strength Labels:**
- Strong: W > 0.7
- Moderate: 0.4 < W ≤ 0.7
- Weak: 0.2 < W ≤ 0.4
- Minimal: W ≤ 0.2

### 5. Risk Scorer

**Purpose:** Compute formalized risk scores for entities.

**Formula:**
```
Risk(entity) = w1 * anomaly_score + w2 * association_risk + w3 * behavior_score
```
Default weights: w1=0.4, w2=0.3, w3=0.3

**Components:**
- **Anomaly Score:** EWMA (α=0.3) of recent anomaly scores
- **Association Risk:** Damped propagation from connected entities: `Σ(relationship_weight * risk * damping_factor)`
- **Behavior Score:** Confidence-weighted behavioral risk with inherent weights per behavior type

**Risk Levels:**
- Low: [0.0, 0.25)
- Medium: [0.25, 0.50)
- High: [0.50, 0.75)
- Critical: [0.75, 1.0]

### 6. Predictor

**Purpose:** Predict next entity appearance (time and location).

**Time Prediction Methods:**
- **Periodic:** If periodicity detected, extrapolates from last seen using dominant period
- **Empirical:** Fits log-normal distribution to inter-arrival times, returns median with confidence interval

**Location Prediction:**
- Decay-weighted frequency analysis (decay_rate=0.005, half-life ≈ 139h)
- Returns most likely location with probability score

### 7. NL Query Translator

**Purpose:** Translate natural language questions to verified database queries.

**Method:** Pattern-based intent classification (9 supported patterns), template-based SQL/Cypher generation.

**Supported Patterns:**
1. Entity frequency queries
2. Temporal/recent queries
3. Entity at location queries
4. Association queries
5. Behavior search queries
6. Risk assessment queries
7. Anomaly search queries
8. Entity timeline queries
9. Prediction queries

**Safety:** No LLM hallucination — all queries are template-based with parameterized values.

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/intelligence/events` | POST/GET | Create/list temporal events |
| `/intelligence/profiles` | GET | List entity intelligence profiles |
| `/intelligence/profiles/{id}` | GET | Get entity profile |
| `/intelligence/behaviors` | GET | List behavior records |
| `/intelligence/insights` | GET | List intelligence insights |
| `/intelligence/analyze` | POST | Run full entity analysis |
| `/intelligence/analyze-batch` | POST | Batch analysis on all entities |
| `/intelligence/query` | POST | Natural language query |
| `/intelligence/risk/{id}` | GET | Get entity risk score |
| `/intelligence/predictions/{id}` | GET | Get entity predictions |

## Database Schema

### New Tables

- **entity_profiles**: Dynamic intelligence profiles with risk scores, predictions, temporal patterns
- **temporal_events**: Timestamped events with hour/day/weekend annotations for pattern mining
- **behavior_records**: Detected behavior patterns with confidence and statistical evidence
- **intelligence_insights**: Generated insights with severity, evidence, and recommendations

### Neo4j Updates

- CO_OCCURRED_WITH edges now store: `count`, `first_seen`, `last_seen`, `timestamps[]`, `weight`, `strength`
- Weight is computed by the RelationshipEngine using exponential decay

## Frontend Views

1. **Intelligence Dashboard**: Risk distribution, top entities, insights, behavior summary
2. **Timeline View**: Chronological event feed with date grouping and entity filtering
3. **Story Mode**: Complete intelligence narrative for a single entity
4. **Graph Explorer**: Interactive force-directed graph with drag, zoom, pan
5. **NL Query Interface**: Natural language search with query explanation and SQL/Cypher display

## Explainability

Every intelligence output includes:
- **WHY** it was flagged (statistical reasoning)
- **Evidence** (underlying data points, test statistics)
- **Confidence** score (0-1, derived from statistical significance)
- **Method** used (FFT, binomial test, z-score, etc.)
