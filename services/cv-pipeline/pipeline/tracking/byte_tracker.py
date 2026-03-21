"""ByteTrack-based multi-object tracker.

Implements a simplified ByteTrack algorithm for multi-object tracking.
Uses IoU-based association with Kalman filter prediction.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
from scipy.optimize import linear_sum_assignment

logger = logging.getLogger(__name__)


@dataclass
class Track:
    """A tracked object with persistent ID."""

    track_id: int
    bbox: np.ndarray  # [x1, y1, x2, y2]
    confidence: float
    class_id: int
    class_name: str
    age: int = 0  # frames since creation
    hits: int = 1  # total successful associations
    time_since_update: int = 0  # frames since last update
    state: str = "tentative"  # tentative, confirmed, deleted

    # Velocity estimation (simple linear model)
    velocity: Optional[np.ndarray] = None
    _prev_bbox: Optional[np.ndarray] = None

    def update(self, bbox: np.ndarray, confidence: float) -> None:
        """Update track with new detection."""
        if self._prev_bbox is not None:
            self.velocity = bbox[:2] - self._prev_bbox[:2]
        self._prev_bbox = self.bbox.copy()
        self.bbox = bbox
        self.confidence = confidence
        self.hits += 1
        self.time_since_update = 0
        self.age += 1

        if self.hits >= 3:
            self.state = "confirmed"

    def predict(self) -> np.ndarray:
        """Predict next position using velocity."""
        if self.velocity is not None:
            predicted = self.bbox.copy()
            predicted[:2] += self.velocity
            predicted[2:] += self.velocity
            return predicted
        return self.bbox.copy()

    def mark_missed(self) -> None:
        """Mark track as missed this frame."""
        self.time_since_update += 1
        self.age += 1

    @property
    def is_confirmed(self) -> bool:
        return self.state == "confirmed"


class ByteTracker:
    """Simplified ByteTrack multi-object tracker.

    Key design decisions:
    - Two-stage association (high/low confidence detections)
    - IoU-based cost matrix
    - Simple velocity-based prediction
    - No deep appearance features (handled separately by CLIP embeddings)
    """

    def __init__(
        self,
        max_age: int = 30,
        min_hits: int = 3,
        iou_threshold: float = 0.3,
        high_conf_threshold: float = 0.5,
        low_conf_threshold: float = 0.1,
    ) -> None:
        self.max_age = max_age
        self.min_hits = min_hits
        self.iou_threshold = iou_threshold
        self.high_conf_threshold = high_conf_threshold
        self.low_conf_threshold = low_conf_threshold

        self.tracks: list[Track] = []
        self._next_id = 1
        self.frame_count = 0

    def update(
        self,
        detections: list[dict],
    ) -> list[Track]:
        """Update tracker with new frame detections.

        Args:
            detections: List of dicts with keys:
                - bbox: [x1, y1, x2, y2]
                - confidence: float
                - class_id: int
                - class_name: str

        Returns:
            List of active (confirmed) tracks
        """
        self.frame_count += 1

        if not detections:
            for track in self.tracks:
                track.mark_missed()
            self._remove_dead_tracks()
            return [t for t in self.tracks if t.is_confirmed]

        # Split detections by confidence
        high_dets = [d for d in detections if d["confidence"] >= self.high_conf_threshold]
        low_dets = [
            d
            for d in detections
            if self.low_conf_threshold <= d["confidence"] < self.high_conf_threshold
        ]

        # Predict track positions
        for track in self.tracks:
            track.predict()

        # First association: high confidence detections with all tracks
        confirmed_tracks = [t for t in self.tracks if t.is_confirmed]
        tentative_tracks = [t for t in self.tracks if not t.is_confirmed]

        matched_h, unmatched_tracks_h, unmatched_dets_h = self._associate(
            confirmed_tracks, high_dets
        )

        # Update matched tracks
        for track_idx, det_idx in matched_h:
            det = high_dets[det_idx]
            confirmed_tracks[track_idx].update(
                np.array(det["bbox"]), det["confidence"]
            )

        # Second association: low confidence detections with remaining tracks
        remaining_tracks = [confirmed_tracks[i] for i in unmatched_tracks_h]
        matched_l, unmatched_tracks_l, _ = self._associate(remaining_tracks, low_dets)

        for track_idx, det_idx in matched_l:
            det = low_dets[det_idx]
            remaining_tracks[track_idx].update(
                np.array(det["bbox"]), det["confidence"]
            )

        # Associate tentative tracks with unmatched high detections
        unmatched_high_dets = [high_dets[i] for i in unmatched_dets_h]
        matched_t, _, unmatched_dets_t = self._associate(
            tentative_tracks, unmatched_high_dets
        )

        for track_idx, det_idx in matched_t:
            det = unmatched_high_dets[det_idx]
            tentative_tracks[track_idx].update(
                np.array(det["bbox"]), det["confidence"]
            )

        # Mark unmatched tracks as missed
        for i in unmatched_tracks_l:
            remaining_tracks[i].mark_missed()

        for track in tentative_tracks:
            if not any(track_idx == tentative_tracks.index(track) for track_idx, _ in matched_t):
                track.mark_missed()

        # Create new tracks for unmatched high-confidence detections
        for i in unmatched_dets_t:
            det = unmatched_high_dets[i]
            new_track = Track(
                track_id=self._next_id,
                bbox=np.array(det["bbox"]),
                confidence=det["confidence"],
                class_id=det["class_id"],
                class_name=det["class_name"],
            )
            self.tracks.append(new_track)
            self._next_id += 1

        self._remove_dead_tracks()

        return [t for t in self.tracks if t.is_confirmed]

    def _associate(
        self, tracks: list[Track], detections: list[dict]
    ) -> tuple[list[tuple[int, int]], list[int], list[int]]:
        """Associate tracks with detections using IoU."""
        if not tracks or not detections:
            return [], list(range(len(tracks))), list(range(len(detections)))

        # Build IoU cost matrix
        cost_matrix = np.zeros((len(tracks), len(detections)))
        for t_idx, track in enumerate(tracks):
            for d_idx, det in enumerate(detections):
                iou = self._compute_iou(track.bbox, np.array(det["bbox"]))
                cost_matrix[t_idx, d_idx] = 1 - iou  # Cost = 1 - IoU

        # Hungarian algorithm
        row_indices, col_indices = linear_sum_assignment(cost_matrix)

        matched = []
        unmatched_tracks = set(range(len(tracks)))
        unmatched_dets = set(range(len(detections)))

        for r, c in zip(row_indices, col_indices):
            if cost_matrix[r, c] <= (1 - self.iou_threshold):
                matched.append((r, c))
                unmatched_tracks.discard(r)
                unmatched_dets.discard(c)

        return matched, list(unmatched_tracks), list(unmatched_dets)

    @staticmethod
    def _compute_iou(bbox1: np.ndarray, bbox2: np.ndarray) -> float:
        """Compute IoU between two bounding boxes [x1, y1, x2, y2]."""
        x1 = max(bbox1[0], bbox2[0])
        y1 = max(bbox1[1], bbox2[1])
        x2 = min(bbox1[2], bbox2[2])
        y2 = min(bbox1[3], bbox2[3])

        intersection = max(0, x2 - x1) * max(0, y2 - y1)
        area1 = (bbox1[2] - bbox1[0]) * (bbox1[3] - bbox1[1])
        area2 = (bbox2[2] - bbox2[0]) * (bbox2[3] - bbox2[1])
        union = area1 + area2 - intersection

        return intersection / union if union > 0 else 0.0

    def _remove_dead_tracks(self) -> None:
        """Remove tracks that have been lost for too long."""
        self.tracks = [
            t
            for t in self.tracks
            if t.time_since_update <= self.max_age
            and not (t.state == "tentative" and t.time_since_update > 2)
        ]

    def reset(self) -> None:
        """Reset the tracker state."""
        self.tracks = []
        self._next_id = 1
        self.frame_count = 0
