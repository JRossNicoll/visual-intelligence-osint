"""CV Pipeline configuration."""

from typing import Optional

from pydantic_settings import BaseSettings


class PipelineSettings(BaseSettings):
    """CV Pipeline settings loaded from environment variables."""

    # Service
    SERVICE_NAME: str = "viosint-cv-pipeline"
    SERVICE_PORT: int = 8001
    DEBUG: bool = False

    # Backend API
    BACKEND_URL: str = "http://localhost:8000"
    BACKEND_API_PREFIX: str = "/api/v1"

    @property
    def backend_api_url(self) -> str:
        return f"{self.BACKEND_URL}{self.BACKEND_API_PREFIX}"

    # Detection
    YOLO_MODEL: str = "yolov8n.pt"  # nano for speed, use yolov8x.pt for accuracy
    DETECTION_CONFIDENCE: float = 0.5
    DETECTION_IOU_THRESHOLD: float = 0.45
    DETECTION_DEVICE: str = "cpu"  # "cuda:0" for GPU
    DETECTION_CLASSES: Optional[list[int]] = None  # None = all classes

    # Tracking
    TRACKER_TYPE: str = "bytetrack"  # bytetrack or deepsort
    TRACKER_MAX_AGE: int = 30  # frames before track is removed
    TRACKER_MIN_HITS: int = 3  # min detections before track is confirmed
    TRACKER_IOU_THRESHOLD: float = 0.3

    # Embedding
    CLIP_MODEL: str = "ViT-B-32"
    CLIP_PRETRAINED: str = "openai"
    EMBEDDING_DEVICE: str = "cpu"
    EMBEDDING_BATCH_SIZE: int = 16

    # Processing
    PROCESSING_FPS: int = 10  # Target processing FPS
    MAX_CONCURRENT_STREAMS: int = 4
    FRAME_SKIP: int = 1  # Process every Nth frame
    FRAME_RESIZE_WIDTH: int = 640
    FRAME_RESIZE_HEIGHT: int = 480

    # Storage
    FRAME_CAPTURE_DIR: str = "/tmp/viosint/frames"
    THUMBNAIL_DIR: str = "/tmp/viosint/thumbnails"
    THUMBNAIL_SIZE: tuple[int, int] = (128, 128)

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    @property
    def redis_url(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


pipeline_settings = PipelineSettings()
