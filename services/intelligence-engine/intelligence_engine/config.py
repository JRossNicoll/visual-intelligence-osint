"""Configuration for the intelligence engine service."""

from pydantic_settings import BaseSettings


class IntelligenceSettings(BaseSettings):
    """Intelligence engine configuration."""

    # Database connections
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "viosint"
    postgres_password: str = "viosint_dev"
    postgres_db: str = "viosint"

    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0

    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "viosint_dev"

    # Analysis settings
    min_events_for_analysis: int = 3
    analysis_batch_size: int = 100
    analysis_interval_seconds: int = 60

    # Risk scoring weights (must sum to 1.0)
    risk_w1_anomaly: float = 0.4
    risk_w2_association: float = 0.3
    risk_w3_behavior: float = 0.3

    # Relationship decay
    relationship_decay_rate: float = 0.01  # Half-life ~69 hours

    # Anomaly detection
    anomaly_contamination: float = 0.05
    anomaly_z_threshold: float = 2.0

    # Redis streams
    event_stream_key: str = "viosint:events:detections"
    insight_stream_key: str = "viosint:events:insights"
    consumer_group: str = "intelligence-engine"
    consumer_name: str = "worker-1"

    model_config = {"env_prefix": "INTEL_"}


settings = IntelligenceSettings()
