-- VIOSINT Database Initialization
-- This runs on first PostgreSQL container start

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy text search

-- Performance tuning for analytics workloads
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET work_mem = '64MB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET effective_cache_size = '512MB';

-- Enable parallel query execution
ALTER SYSTEM SET max_parallel_workers_per_gather = 2;
ALTER SYSTEM SET max_parallel_workers = 4;

-- ============================================
-- Intelligence Engine Tables
-- ============================================

-- Entity Profiles: Dynamic intelligence profiles for tracked entities
CREATE TABLE IF NOT EXISTS entity_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id VARCHAR(36) NOT NULL UNIQUE,
    entity_type VARCHAR(50) NOT NULL,
    first_seen TIMESTAMPTZ NOT NULL,
    last_seen TIMESTAMPTZ NOT NULL,
    visit_count INTEGER NOT NULL DEFAULT 1,
    total_duration_seconds FLOAT NOT NULL DEFAULT 0.0,
    common_locations JSONB,
    last_location_id VARCHAR(36),
    last_location_name VARCHAR(255),
    behavior_summary JSONB,
    behavior_tags JSONB,
    temporal_pattern JSONB,
    associated_entities JSONB,
    association_count INTEGER NOT NULL DEFAULT 0,
    risk_score FLOAT NOT NULL DEFAULT 0.0,
    risk_factors JSONB,
    risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
    predicted_next_location JSONB,
    predicted_next_time JSONB,
    profile_completeness FLOAT NOT NULL DEFAULT 0.0,
    last_analyzed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_profiles_entity_id ON entity_profiles(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_profiles_risk_score ON entity_profiles(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_entity_profiles_risk_level ON entity_profiles(risk_level);

-- Temporal Events: Timestamped intelligence events for pattern mining
CREATE TABLE IF NOT EXISTS temporal_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id VARCHAR(36) NOT NULL,
    stream_id VARCHAR(36) NOT NULL,
    location_id VARCHAR(36),
    location_name VARCHAR(255),
    event_type VARCHAR(50) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    duration_seconds FLOAT,
    confidence FLOAT NOT NULL,
    attributes JSONB,
    co_occurring_entities JSONB,
    hour_of_day INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    is_weekend BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_temporal_events_entity_id ON temporal_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_temporal_events_stream_id ON temporal_events(stream_id);
CREATE INDEX IF NOT EXISTS idx_temporal_events_location_id ON temporal_events(location_id);
CREATE INDEX IF NOT EXISTS idx_temporal_events_timestamp ON temporal_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_temporal_events_event_type ON temporal_events(event_type);

-- Behavior Records: Detected behavior patterns for entities
CREATE TABLE IF NOT EXISTS behavior_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id VARCHAR(36) NOT NULL,
    behavior_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    confidence FLOAT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'low',
    location_id VARCHAR(36),
    location_name VARCHAR(255),
    stream_id VARCHAR(36),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_seconds FLOAT,
    associated_entity_ids JSONB,
    pattern_data JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_behavior_records_entity_id ON behavior_records(entity_id);
CREATE INDEX IF NOT EXISTS idx_behavior_records_behavior_type ON behavior_records(behavior_type);
CREATE INDEX IF NOT EXISTS idx_behavior_records_is_active ON behavior_records(is_active);

-- Intelligence Insights: Generated intelligence from pattern analysis
CREATE TABLE IF NOT EXISTS intelligence_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    insight_type VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    entity_ids JSONB,
    location_ids JSONB,
    stream_ids JSONB,
    confidence FLOAT NOT NULL,
    evidence JSONB,
    recommendation TEXT,
    is_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
    is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intelligence_insights_type ON intelligence_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_intelligence_insights_severity ON intelligence_insights(severity);
CREATE INDEX IF NOT EXISTS idx_intelligence_insights_dismissed ON intelligence_insights(is_dismissed);
