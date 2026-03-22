"""Configuration for the event processor service."""

from pydantic_settings import BaseSettings


class EventProcessorSettings(BaseSettings):
    """Event processor configuration."""

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0

    # Streams
    detection_stream: str = "viosint:events:detections"
    insight_stream: str = "viosint:events:insights"
    consumer_group: str = "event-processor"
    consumer_name: str = "worker-1"
    batch_size: int = 10
    block_ms: int = 5000

    # Intelligence engine
    intelligence_engine_url: str = "http://localhost:8001"

    # Backend API
    backend_api_url: str = "http://localhost:8000"

    # Processing
    analysis_interval_seconds: int = 60
    min_events_for_analysis: int = 3

    model_config = {"env_prefix": "EVT_"}


settings = EventProcessorSettings()
