"""Attribute extraction module.

Extracts structured attributes from detected objects:
- Color (dominant color analysis)
- Vehicle type classification
- Person clothing/appearance attributes
"""

import logging
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# Standard color names and their HSV ranges
COLOR_RANGES = {
    "red": [(0, 70, 50), (10, 255, 255)],
    "red2": [(170, 70, 50), (180, 255, 255)],
    "orange": [(10, 70, 50), (25, 255, 255)],
    "yellow": [(25, 70, 50), (35, 255, 255)],
    "green": [(35, 70, 50), (85, 255, 255)],
    "blue": [(85, 70, 50), (130, 255, 255)],
    "purple": [(130, 70, 50), (170, 255, 255)],
    "white": [(0, 0, 180), (180, 30, 255)],
    "black": [(0, 0, 0), (180, 255, 50)],
    "gray": [(0, 0, 50), (180, 30, 180)],
}

# Vehicle type mapping based on aspect ratio and size
VEHICLE_TYPES = {
    "sedan": {"aspect_min": 1.5, "aspect_max": 2.5, "area_max": 0.15},
    "suv": {"aspect_min": 1.2, "aspect_max": 2.0, "area_min": 0.08},
    "truck": {"aspect_min": 1.8, "aspect_max": 4.0, "area_min": 0.1},
    "motorcycle": {"aspect_min": 0.5, "aspect_max": 1.8, "area_max": 0.05},
    "bus": {"aspect_min": 2.0, "aspect_max": 5.0, "area_min": 0.15},
}


class AttributeExtractor:
    """Extracts structured attributes from detected objects."""

    def extract_attributes(
        self,
        frame: np.ndarray,
        bbox: tuple[float, float, float, float],
        class_name: str,
    ) -> dict:
        """Extract attributes based on object type.

        Args:
            frame: BGR image (H, W, C)
            bbox: (x1, y1, x2, y2) bounding box
            class_name: YOLO class name

        Returns:
            Dictionary of extracted attributes
        """
        x1, y1, x2, y2 = [int(v) for v in bbox]
        h, w = frame.shape[:2]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)

        if x2 <= x1 or y2 <= y1:
            return {}

        crop = frame[y1:y2, x1:x2]

        attributes: dict = {"class": class_name}

        # Extract color
        dominant_color = self._extract_dominant_color(crop)
        if dominant_color:
            attributes["color"] = dominant_color

        # Vehicle-specific attributes
        if class_name in ("car", "truck", "bus", "motorcycle"):
            vehicle_type = self._classify_vehicle_type(bbox, (h, w), class_name)
            attributes["vehicle_type"] = vehicle_type

        # Person-specific attributes
        if class_name == "person":
            person_attrs = self._extract_person_attributes(crop)
            attributes.update(person_attrs)

        return attributes

    def _extract_dominant_color(self, crop: np.ndarray) -> Optional[str]:
        """Extract the dominant color from a crop using HSV analysis."""
        try:
            import cv2

            if crop.size == 0:
                return None

            hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
            color_scores: dict[str, float] = {}

            for color_name, (lower, upper) in COLOR_RANGES.items():
                mask = cv2.inRange(hsv, np.array(lower), np.array(upper))
                score = float(np.sum(mask > 0)) / mask.size
                # Merge red ranges
                actual_name = "red" if color_name == "red2" else color_name
                if actual_name in color_scores:
                    color_scores[actual_name] += score
                else:
                    color_scores[actual_name] = score

            if color_scores:
                dominant = max(color_scores, key=color_scores.get)  # type: ignore[arg-type]
                if color_scores[dominant] > 0.1:  # At least 10% of pixels
                    return dominant

            return None
        except Exception as e:
            logger.debug("Color extraction error: %s", e)
            return None

    def _classify_vehicle_type(
        self,
        bbox: tuple[float, float, float, float],
        frame_shape: tuple[int, int],
        class_name: str,
    ) -> str:
        """Classify vehicle type based on bounding box characteristics."""
        x1, y1, x2, y2 = bbox
        w = x2 - x1
        h = y2 - y1
        aspect_ratio = w / h if h > 0 else 1.0
        frame_h, frame_w = frame_shape
        relative_area = (w * h) / (frame_w * frame_h)

        # Direct class name mapping
        if class_name == "truck":
            return "truck"
        if class_name == "bus":
            return "bus"
        if class_name == "motorcycle":
            return "motorcycle"

        # Heuristic classification for cars
        if aspect_ratio > 1.8 and relative_area > 0.1:
            return "truck"
        if aspect_ratio < 1.6 and relative_area > 0.06:
            return "suv"
        return "sedan"

    def _extract_person_attributes(self, crop: np.ndarray) -> dict:
        """Extract person-specific attributes from crop."""
        attrs: dict = {}

        try:
            import cv2

            h, w = crop.shape[:2]
            if h < 10 or w < 10:
                return attrs

            # Split into upper and lower body
            upper = crop[: h // 2, :]
            lower = crop[h // 2 :, :]

            upper_color = self._extract_dominant_color(upper)
            lower_color = self._extract_dominant_color(lower)

            if upper_color:
                attrs["upper_clothing_color"] = upper_color
            if lower_color:
                attrs["lower_clothing_color"] = lower_color

            # Estimate relative height (person size relative to frame)
            attrs["relative_size"] = round(h / max(w, 1), 2)

        except Exception as e:
            logger.debug("Person attribute extraction error: %s", e)

        return attrs
