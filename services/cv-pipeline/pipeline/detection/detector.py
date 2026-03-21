"""Object detection module using YOLOv8.

Uses Ultralytics YOLOv8 for real-time object detection.
Supports multiple model sizes (nano to extra-large) for
speed/accuracy tradeoffs.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class DetectionResult:
    """A single detection from the detector."""

    bbox: tuple[float, float, float, float]  # x1, y1, x2, y2
    confidence: float
    class_id: int
    class_name: str

    @property
    def bbox_xywh(self) -> tuple[float, float, float, float]:
        """Convert to center x, y, width, height format."""
        x1, y1, x2, y2 = self.bbox
        w = x2 - x1
        h = y2 - y1
        cx = x1 + w / 2
        cy = y1 + h / 2
        return (cx, cy, w, h)

    @property
    def bbox_tlwh(self) -> tuple[float, float, float, float]:
        """Convert to top-left x, y, width, height format."""
        x1, y1, x2, y2 = self.bbox
        return (x1, y1, x2 - x1, y2 - y1)


@dataclass
class FrameDetections:
    """All detections for a single frame."""

    frame_number: int
    detections: list[DetectionResult] = field(default_factory=list)
    inference_time_ms: float = 0.0

    @property
    def count(self) -> int:
        return len(self.detections)


class ObjectDetector:
    """YOLOv8-based object detector.

    Wraps Ultralytics YOLO model for consistent interface.
    Handles model loading, inference, and result parsing.
    """

    def __init__(
        self,
        model_path: str = "yolov8n.pt",
        confidence_threshold: float = 0.5,
        iou_threshold: float = 0.45,
        device: str = "cpu",
        classes: Optional[list[int]] = None,
    ) -> None:
        self.model_path = model_path
        self.confidence_threshold = confidence_threshold
        self.iou_threshold = iou_threshold
        self.device = device
        self.classes = classes
        self._model = None
        self._loaded = False

    def load(self) -> None:
        """Load the YOLO model."""
        try:
            from ultralytics import YOLO

            logger.info("Loading YOLO model: %s on device: %s", self.model_path, self.device)
            self._model = YOLO(self.model_path)
            self._loaded = True
            logger.info("YOLO model loaded successfully")
        except Exception as e:
            logger.error("Failed to load YOLO model: %s", e)
            raise

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def detect(self, frame: np.ndarray, frame_number: int = 0) -> FrameDetections:
        """Run detection on a single frame.

        Args:
            frame: BGR image as numpy array (H, W, C)
            frame_number: Frame index for tracking

        Returns:
            FrameDetections containing all detections
        """
        if not self._loaded or self._model is None:
            raise RuntimeError("Model not loaded. Call load() first.")

        import time

        start = time.perf_counter()

        results = self._model(
            frame,
            conf=self.confidence_threshold,
            iou=self.iou_threshold,
            device=self.device,
            classes=self.classes,
            verbose=False,
        )

        elapsed_ms = (time.perf_counter() - start) * 1000

        detections: list[DetectionResult] = []

        for result in results:
            if result.boxes is None:
                continue

            boxes = result.boxes
            for i in range(len(boxes)):
                bbox = boxes.xyxy[i].cpu().numpy()
                conf = float(boxes.conf[i].cpu().numpy())
                cls_id = int(boxes.cls[i].cpu().numpy())
                cls_name = result.names.get(cls_id, f"class_{cls_id}")

                detections.append(
                    DetectionResult(
                        bbox=(float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])),
                        confidence=conf,
                        class_id=cls_id,
                        class_name=cls_name,
                    )
                )

        return FrameDetections(
            frame_number=frame_number,
            detections=detections,
            inference_time_ms=elapsed_ms,
        )

    def detect_batch(
        self, frames: list[np.ndarray], frame_numbers: Optional[list[int]] = None
    ) -> list[FrameDetections]:
        """Run detection on a batch of frames."""
        if frame_numbers is None:
            frame_numbers = list(range(len(frames)))

        return [
            self.detect(frame, num) for frame, num in zip(frames, frame_numbers)
        ]

    @property
    def class_names(self) -> dict[int, str]:
        """Get the model's class name mapping."""
        if self._model and hasattr(self._model, "names"):
            return self._model.names
        return {}
