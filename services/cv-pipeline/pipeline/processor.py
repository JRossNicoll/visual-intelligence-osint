"""Main pipeline processor that orchestrates detection, tracking, embedding, and extraction.

This is the core processing loop that:
1. Ingests video frames (from RTSP, file, or WebRTC)
2. Runs YOLOv8 detection
3. Runs ByteTrack multi-object tracking
4. Generates CLIP embeddings for detected objects
5. Extracts structured attributes
6. Sends results to the backend API
"""

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

import cv2
import httpx
import numpy as np

from pipeline.config import pipeline_settings
from pipeline.detection.detector import ObjectDetector
from pipeline.embedding.clip_embedder import CLIPEmbedder
from pipeline.extraction.attribute_extractor import AttributeExtractor
from pipeline.tracking.byte_tracker import ByteTracker

logger = logging.getLogger(__name__)


class PipelineProcessor:
    """Orchestrates the full CV pipeline for a video stream.

    Pipeline stages:
    1. Frame ingestion (video capture)
    2. Object detection (YOLOv8)
    3. Multi-object tracking (ByteTrack)
    4. Embedding generation (CLIP)
    5. Attribute extraction
    6. Result delivery (to backend API)
    """

    def __init__(
        self,
        stream_id: str,
        source: str,
        processing_fps: int = 10,
        detection_confidence: float = 0.5,
        enable_tracking: bool = True,
        enable_embedding: bool = True,
    ) -> None:
        self.stream_id = stream_id
        self.source = source
        self.processing_fps = processing_fps
        self.detection_confidence = detection_confidence
        self.enable_tracking = enable_tracking
        self.enable_embedding = enable_embedding

        # Pipeline components
        self.detector = ObjectDetector(
            model_path=pipeline_settings.YOLO_MODEL,
            confidence_threshold=detection_confidence,
            device=pipeline_settings.DETECTION_DEVICE,
        )
        self.tracker = ByteTracker(
            max_age=pipeline_settings.TRACKER_MAX_AGE,
            min_hits=pipeline_settings.TRACKER_MIN_HITS,
            iou_threshold=pipeline_settings.TRACKER_IOU_THRESHOLD,
        )
        self.embedder = CLIPEmbedder(
            model_name=pipeline_settings.CLIP_MODEL,
            pretrained=pipeline_settings.CLIP_PRETRAINED,
            device=pipeline_settings.EMBEDDING_DEVICE,
        )
        self.attribute_extractor = AttributeExtractor()

        # State
        self._running = False
        self._cap: Optional[cv2.VideoCapture] = None
        self.frame_count = 0
        self.detection_count = 0
        self.current_fps = 0.0
        self._http_client: Optional[httpx.AsyncClient] = None

    def load_models(self) -> None:
        """Load all ML models."""
        logger.info("Loading ML models...")
        self.detector.load()
        if self.enable_embedding:
            self.embedder.load()
        logger.info("All models loaded")

    async def start(self) -> None:
        """Start processing the video stream."""
        if self._running:
            logger.warning("Pipeline already running for stream %s", self.stream_id)
            return

        self._running = True
        self._http_client = httpx.AsyncClient(timeout=30.0)

        # Ensure output directories exist
        os.makedirs(pipeline_settings.THUMBNAIL_DIR, exist_ok=True)
        os.makedirs(pipeline_settings.FRAME_CAPTURE_DIR, exist_ok=True)

        logger.info("Starting pipeline for stream %s, source: %s", self.stream_id, self.source)

        try:
            await self._process_stream()
        except Exception as e:
            logger.error("Pipeline error for stream %s: %s", self.stream_id, e)
        finally:
            self._running = False
            if self._cap:
                self._cap.release()
            if self._http_client:
                await self._http_client.aclose()

    async def stop(self) -> None:
        """Stop the pipeline."""
        self._running = False

    @property
    def is_running(self) -> bool:
        return self._running

    async def _process_stream(self) -> None:
        """Main processing loop."""
        self._cap = cv2.VideoCapture(self.source)
        if not self._cap.isOpened():
            logger.error("Failed to open video source: %s", self.source)
            return

        source_fps = self._cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_interval = 1.0 / self.processing_fps
        skip_ratio = max(1, int(source_fps / self.processing_fps))

        logger.info(
            "Stream opened: %.1f FPS source, processing at %d FPS (skip every %d frames)",
            source_fps,
            self.processing_fps,
            skip_ratio,
        )

        frame_idx = 0
        last_stats_time = time.time()
        frames_since_stats = 0

        while self._running:
            loop_start = time.time()

            ret, frame = self._cap.read()
            if not ret:
                # End of video file or stream error
                if not self.source.startswith("rtsp"):
                    logger.info("End of video file reached")
                    break
                # For RTSP, try to reconnect
                logger.warning("Frame read failed, attempting reconnect...")
                await asyncio.sleep(1)
                self._cap.release()
                self._cap = cv2.VideoCapture(self.source)
                continue

            frame_idx += 1

            # Skip frames to match target FPS
            if frame_idx % skip_ratio != 0:
                continue

            self.frame_count += 1
            frames_since_stats += 1

            # Resize frame for processing
            frame_resized = cv2.resize(
                frame,
                (pipeline_settings.FRAME_RESIZE_WIDTH, pipeline_settings.FRAME_RESIZE_HEIGHT),
            )

            # Stage 1: Detection
            frame_detections = self.detector.detect(frame_resized, self.frame_count)

            # Stage 2: Tracking
            active_tracks = []
            if self.enable_tracking and frame_detections.detections:
                track_inputs = [
                    {
                        "bbox": list(d.bbox),
                        "confidence": d.confidence,
                        "class_id": d.class_id,
                        "class_name": d.class_name,
                    }
                    for d in frame_detections.detections
                ]
                active_tracks = self.tracker.update(track_inputs)
            elif self.enable_tracking:
                active_tracks = self.tracker.update([])

            # Stage 3 & 4: Embedding + Attribute extraction for each detection
            pipeline_detections = []

            for det in frame_detections.detections:
                # Find matching track
                track_id = None
                if active_tracks:
                    for track in active_tracks:
                        iou = ByteTracker._compute_iou(
                            np.array(det.bbox), track.bbox
                        )
                        if iou > 0.5:
                            track_id = track.track_id
                            break

                # Extract attributes
                attributes = self.attribute_extractor.extract_attributes(
                    frame_resized, det.bbox, det.class_name
                )

                # Generate CLIP embedding (not every frame for performance)
                embedding = None
                if self.enable_embedding and self.frame_count % 5 == 0:
                    embedding = self.embedder.embed_image_crop(frame_resized, det.bbox)

                pipeline_detections.append(
                    {
                        "label": det.class_name,
                        "confidence": round(det.confidence, 4),
                        "bbox": [round(v, 2) for v in det.bbox_tlwh],
                        "track_id": track_id,
                        "attributes": attributes,
                        "embedding": embedding,
                    }
                )

            self.detection_count += len(pipeline_detections)

            # Send results to backend
            if pipeline_detections:
                await self._send_frame_result(pipeline_detections)

            # Update FPS stats periodically
            now = time.time()
            if now - last_stats_time >= 2.0:
                self.current_fps = frames_since_stats / (now - last_stats_time)
                frames_since_stats = 0
                last_stats_time = now
                await self._send_stats_update()

            # Throttle to target FPS
            elapsed = time.time() - loop_start
            sleep_time = frame_interval - elapsed
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)

        logger.info(
            "Pipeline stopped for stream %s. Processed %d frames, %d detections",
            self.stream_id,
            self.frame_count,
            self.detection_count,
        )

    async def _send_frame_result(self, detections: list[dict]) -> None:
        """Send frame results to the backend API."""
        if not self._http_client:
            return

        payload = {
            "stream_id": self.stream_id,
            "frame_number": self.frame_count,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "detections": detections,
            "processing_fps": round(self.current_fps, 2),
        }

        try:
            url = f"{pipeline_settings.backend_api_url}/pipeline/frame-result"
            response = await self._http_client.post(url, json=payload)
            if response.status_code != 200:
                logger.warning(
                    "Backend rejected frame result: %d %s",
                    response.status_code,
                    response.text[:200],
                )
        except Exception as e:
            logger.debug("Failed to send frame result: %s", e)

    async def _send_stats_update(self) -> None:
        """Send statistics update to the backend API."""
        if not self._http_client:
            return

        payload = {
            "stream_id": self.stream_id,
            "frames_processed": self.frame_count,
            "detections_count": self.detection_count,
            "active_tracks": len(
                [t for t in self.tracker.tracks if t.is_confirmed]
            ),
            "current_fps": round(self.current_fps, 2),
        }

        try:
            url = f"{pipeline_settings.backend_api_url}/pipeline/stats"
            await self._http_client.post(url, json=payload)
        except Exception as e:
            logger.debug("Failed to send stats update: %s", e)

    def save_thumbnail(self, frame: np.ndarray, entity_id: str) -> str:
        """Save a thumbnail image for an entity."""
        thumb_path = os.path.join(
            pipeline_settings.THUMBNAIL_DIR,
            f"{entity_id}.jpg",
        )
        tw, th = pipeline_settings.THUMBNAIL_SIZE
        thumb = cv2.resize(frame, (tw, th))
        cv2.imwrite(thumb_path, thumb)
        return thumb_path
