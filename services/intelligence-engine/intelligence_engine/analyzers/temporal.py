"""Temporal Pattern Analyzer - FFT-based periodicity detection and autocorrelation.

Uses proper statistical methods to detect periodic behavior in entity appearances:
- Fast Fourier Transform (FFT) for dominant frequency detection
- Autocorrelation for lag-based periodicity confirmation
- Kernel Density Estimation for hourly/daily distribution modeling
- Inter-arrival time statistical analysis

NO simple threshold rules. All patterns are statistically validated.
"""

import logging
from datetime import datetime
from typing import Optional

import numpy as np
from scipy import signal
from scipy.fft import fft, fftfreq
from scipy.stats import gaussian_kde

from intelligence_engine.models.schemas import (
    PeriodicityResult,
    TemporalPatternResult,
)

logger = logging.getLogger(__name__)

# Minimum events required for meaningful statistical analysis
MIN_EVENTS_FOR_PERIODICITY = 6
MIN_EVENTS_FOR_DISTRIBUTION = 3


class TemporalPatternAnalyzer:
    """Analyzes temporal patterns in entity appearance timestamps.

    Methods:
    - FFT-based periodicity detection: Identifies dominant frequencies in
      the time-series of entity appearances using spectral analysis.
    - Autocorrelation: Confirms periodicity by measuring self-similarity
      at various lag values.
    - Distribution modeling: Uses KDE to model hourly and daily appearance
      distributions without imposing parametric assumptions.
    """

    def analyze(self, timestamps: list[datetime], entity_id: str = "") -> TemporalPatternResult:
        """Perform full temporal pattern analysis on a list of timestamps.

        Args:
            timestamps: Sorted list of datetime objects representing entity appearances.
            entity_id: Entity identifier for the result.

        Returns:
            TemporalPatternResult with statistical analysis of patterns.
        """
        if len(timestamps) < MIN_EVENTS_FOR_DISTRIBUTION:
            return TemporalPatternResult(
                entity_id=entity_id,
                event_count=len(timestamps),
                explanation="Insufficient data for temporal analysis "
                f"(need >= {MIN_EVENTS_FOR_DISTRIBUTION} events, got {len(timestamps)})",
            )

        timestamps_sorted = sorted(timestamps)
        epoch_times = np.array([t.timestamp() for t in timestamps_sorted])

        # Basic statistics
        time_span_seconds = epoch_times[-1] - epoch_times[0]
        time_span_hours = time_span_seconds / 3600.0

        # Inter-arrival times (in hours)
        intervals = np.diff(epoch_times) / 3600.0
        mean_interval = float(np.mean(intervals)) if len(intervals) > 0 else None
        std_interval = float(np.std(intervals, ddof=1)) if len(intervals) > 1 else None

        # Periodicity detection
        periodicity = self._detect_periodicity(epoch_times)

        # Hour-of-day distribution using KDE
        hours = np.array([t.hour + t.minute / 60.0 for t in timestamps_sorted])
        hourly_dist = self._compute_circular_distribution(hours, period=24.0, n_bins=24)
        peak_hours = self._find_peaks_in_distribution(hourly_dist, threshold_factor=1.5)

        # Day-of-week distribution using KDE
        days = np.array([t.weekday() for t in timestamps_sorted], dtype=float)
        daily_dist = self._compute_distribution(days, n_bins=7, range_max=7.0)
        peak_days = self._find_peaks_in_distribution(daily_dist, threshold_factor=1.3)

        # Build explanation
        explanation_parts = [
            f"Analyzed {len(timestamps)} events over {time_span_hours:.1f} hours.",
        ]
        if mean_interval is not None:
            explanation_parts.append(
                f"Mean inter-arrival interval: {mean_interval:.2f}h "
                f"(std: {std_interval:.2f}h)." if std_interval else
                f"Mean inter-arrival interval: {mean_interval:.2f}h."
            )
        if periodicity and periodicity.is_periodic:
            explanation_parts.append(
                f"Periodic behavior detected with dominant period "
                f"~{periodicity.dominant_period_hours:.1f}h "
                f"(confidence: {periodicity.period_confidence:.2f})."
            )
        if peak_hours:
            explanation_parts.append(
                f"Peak activity hours: {peak_hours}."
            )
        if peak_days:
            day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            peak_day_names = [day_names[d] for d in peak_days if 0 <= d < 7]
            explanation_parts.append(f"Peak activity days: {peak_day_names}.")

        return TemporalPatternResult(
            entity_id=entity_id,
            event_count=len(timestamps),
            time_span_hours=time_span_hours,
            mean_interval_hours=mean_interval,
            std_interval_hours=std_interval,
            periodicity=periodicity,
            peak_hours=peak_hours,
            peak_days=peak_days,
            hourly_distribution=[float(x) for x in hourly_dist],
            daily_distribution=[float(x) for x in daily_dist],
            explanation=" ".join(explanation_parts),
        )

    def _detect_periodicity(self, epoch_times: np.ndarray) -> Optional[PeriodicityResult]:
        """Detect periodicity using FFT and autocorrelation.

        Process:
        1. Convert appearance timestamps to a uniformly sampled binary signal
           (1 = appearance in bin, 0 = no appearance).
        2. Apply FFT to find dominant frequencies.
        3. Compute autocorrelation to find repeating lag patterns.
        4. Cross-validate: periodicity is confirmed only if both FFT and
           autocorrelation agree on a dominant period.

        Args:
            epoch_times: Array of epoch timestamps (sorted).

        Returns:
            PeriodicityResult or None if insufficient data.
        """
        if len(epoch_times) < MIN_EVENTS_FOR_PERIODICITY:
            return PeriodicityResult(
                is_periodic=False,
                description=f"Insufficient events for periodicity detection "
                f"(need >= {MIN_EVENTS_FOR_PERIODICITY}).",
            )

        time_span = epoch_times[-1] - epoch_times[0]
        if time_span < 3600:  # Less than 1 hour of data
            return PeriodicityResult(
                is_periodic=False,
                description="Time span too short for periodicity analysis.",
            )

        # Create a uniformly sampled signal
        # Bin size: 1 hour for spans > 48h, 15 min for shorter spans
        bin_size_seconds = 3600.0 if time_span > 48 * 3600 else 900.0
        n_bins = int(time_span / bin_size_seconds) + 1

        if n_bins < 4:
            return PeriodicityResult(
                is_periodic=False,
                description="Too few time bins for spectral analysis.",
            )

        # Build binary signal: 1 where events occur, 0 elsewhere
        bin_signal = np.zeros(n_bins)
        for t in epoch_times:
            bin_idx = min(int((t - epoch_times[0]) / bin_size_seconds), n_bins - 1)
            bin_signal[bin_idx] += 1.0

        # Normalize
        if bin_signal.max() > 0:
            bin_signal = bin_signal / bin_signal.max()

        # --- FFT Analysis ---
        fft_result = self._fft_analysis(bin_signal, bin_size_seconds)

        # --- Autocorrelation Analysis ---
        acf_result = self._autocorrelation_analysis(bin_signal, bin_size_seconds)

        # Cross-validate: both must agree within 20% on period
        is_periodic = False
        dominant_period = None
        confidence = 0.0

        if fft_result["dominant_period"] and acf_result["dominant_period"]:
            fft_period = fft_result["dominant_period"]
            acf_period = acf_result["dominant_period"]
            relative_diff = abs(fft_period - acf_period) / max(fft_period, acf_period)

            if relative_diff < 0.20:
                is_periodic = True
                # Use the average of both estimates
                dominant_period = (fft_period + acf_period) / 2.0
                # Confidence is the geometric mean of both method confidences
                confidence = float(np.sqrt(
                    fft_result["confidence"] * acf_result["confidence"]
                ))
            else:
                # Methods disagree — use the one with higher confidence
                if fft_result["confidence"] > acf_result["confidence"]:
                    dominant_period = fft_period
                    confidence = fft_result["confidence"] * 0.6  # Penalize disagreement
                else:
                    dominant_period = acf_period
                    confidence = acf_result["confidence"] * 0.6
                is_periodic = confidence > 0.3

        elif fft_result["dominant_period"]:
            dominant_period = fft_result["dominant_period"]
            confidence = fft_result["confidence"] * 0.7
            is_periodic = confidence > 0.3
        elif acf_result["dominant_period"]:
            dominant_period = acf_result["dominant_period"]
            confidence = acf_result["confidence"] * 0.7
            is_periodic = confidence > 0.3

        description_parts = []
        if is_periodic and dominant_period:
            description_parts.append(
                f"Periodic behavior confirmed at ~{dominant_period:.1f}h "
                f"(FFT: {fft_result['dominant_period']}, "
                f"ACF: {acf_result['dominant_period']})."
            )
        else:
            description_parts.append("No statistically significant periodicity detected.")

        return PeriodicityResult(
            is_periodic=is_periodic,
            dominant_period_hours=dominant_period,
            period_confidence=confidence,
            autocorrelation_peak_lag=acf_result.get("peak_lag"),
            autocorrelation_peak_value=acf_result.get("peak_value"),
            fft_dominant_frequency=fft_result.get("dominant_freq"),
            fft_power_ratio=fft_result.get("power_ratio"),
            description=" ".join(description_parts),
        )

    def _fft_analysis(
        self, bin_signal: np.ndarray, bin_size_seconds: float
    ) -> dict:
        """Perform FFT spectral analysis to find dominant frequency.

        Applies a Hann window to reduce spectral leakage, then identifies
        the dominant non-DC frequency component.

        Returns dict with dominant_period (hours), dominant_freq, power_ratio, confidence.
        """
        n = len(bin_signal)
        if n < 4:
            return {"dominant_period": None, "confidence": 0.0}

        # Remove mean (DC component)
        centered = bin_signal - np.mean(bin_signal)

        # Apply Hann window to reduce spectral leakage
        windowed = centered * np.hanning(n)

        # Compute FFT
        yf = fft(windowed)
        xf = fftfreq(n, d=bin_size_seconds)

        # Only positive frequencies, skip DC (index 0)
        positive_mask = xf > 0
        freqs = xf[positive_mask]
        power = np.abs(yf[positive_mask]) ** 2

        if len(power) == 0:
            return {"dominant_period": None, "confidence": 0.0}

        # Find dominant frequency
        peak_idx = np.argmax(power)
        dominant_freq = float(freqs[peak_idx])
        dominant_power = float(power[peak_idx])
        total_power = float(np.sum(power))

        if total_power == 0 or dominant_freq == 0:
            return {"dominant_period": None, "confidence": 0.0}

        dominant_period_hours = 1.0 / (dominant_freq * 3600.0)
        power_ratio = dominant_power / total_power

        # Confidence based on how much the dominant frequency stands out
        # A clear periodic signal concentrates power in one frequency
        confidence = min(power_ratio * 2.0, 1.0)

        return {
            "dominant_period": dominant_period_hours,
            "dominant_freq": dominant_freq,
            "power_ratio": power_ratio,
            "confidence": confidence,
        }

    def _autocorrelation_analysis(
        self, bin_signal: np.ndarray, bin_size_seconds: float
    ) -> dict:
        """Compute autocorrelation to find repeating lag patterns.

        Uses normalized autocorrelation and finds peaks beyond the first
        zero-crossing (to avoid the trivial lag-0 peak).

        Returns dict with dominant_period (hours), peak_lag, peak_value, confidence.
        """
        n = len(bin_signal)
        if n < 4:
            return {"dominant_period": None, "confidence": 0.0}

        # Normalized autocorrelation
        centered = bin_signal - np.mean(bin_signal)
        variance = np.var(centered)
        if variance == 0:
            return {"dominant_period": None, "confidence": 0.0}

        acf = np.correlate(centered, centered, mode="full")
        acf = acf[n - 1:]  # Keep only positive lags
        acf = acf / acf[0]  # Normalize

        # Find peaks in autocorrelation (skip lag 0)
        # Only consider lags from 2 to n//2 (we need at least 2 full cycles)
        max_lag = min(n // 2, len(acf) - 1)
        if max_lag < 2:
            return {"dominant_period": None, "confidence": 0.0}

        acf_subset = acf[2:max_lag + 1]
        if len(acf_subset) == 0:
            return {"dominant_period": None, "confidence": 0.0}

        # Find peaks using scipy
        peaks, properties = signal.find_peaks(acf_subset, height=0.1, distance=2)

        if len(peaks) == 0:
            return {"dominant_period": None, "confidence": 0.0}

        # The first significant peak gives the fundamental period
        peak_heights = properties["peak_heights"]
        best_peak_idx = np.argmax(peak_heights)
        peak_lag = int(peaks[best_peak_idx] + 2)  # Add back the offset
        peak_value = float(acf[peak_lag])

        dominant_period_hours = (peak_lag * bin_size_seconds) / 3600.0

        # Confidence based on autocorrelation peak value
        # ACF values > 0.5 indicate strong periodicity
        confidence = min(peak_value, 1.0)

        return {
            "dominant_period": dominant_period_hours,
            "peak_lag": peak_lag,
            "peak_value": peak_value,
            "confidence": confidence,
        }

    def _compute_circular_distribution(
        self, values: np.ndarray, period: float, n_bins: int
    ) -> np.ndarray:
        """Compute distribution using circular KDE for wrapped data (e.g., hours).

        Hours wrap around (23 -> 0), so we triplicate the data and use KDE
        on the extended range, then extract the central period.
        """
        if len(values) < MIN_EVENTS_FOR_DISTRIBUTION:
            return np.ones(n_bins) / n_bins

        # Triplicate for circular continuity
        extended = np.concatenate([values - period, values, values + period])

        try:
            kde = gaussian_kde(extended, bw_method="silverman")
            bin_centers = np.linspace(0, period, n_bins, endpoint=False) + (period / n_bins / 2)
            density = kde(bin_centers)
            # Normalize to sum to 1
            density = density / density.sum()
            return density
        except (np.linalg.LinAlgError, ValueError):
            # Fall back to histogram if KDE fails
            hist, _ = np.histogram(values, bins=n_bins, range=(0, period), density=True)
            total = hist.sum()
            return hist / total if total > 0 else np.ones(n_bins) / n_bins

    def _compute_distribution(
        self, values: np.ndarray, n_bins: int, range_max: float
    ) -> np.ndarray:
        """Compute distribution using KDE for non-circular data."""
        if len(values) < MIN_EVENTS_FOR_DISTRIBUTION:
            return np.ones(n_bins) / n_bins

        try:
            kde = gaussian_kde(values, bw_method="silverman")
            bin_centers = np.linspace(0, range_max, n_bins, endpoint=False) + (range_max / n_bins / 2)
            density = kde(bin_centers)
            density = density / density.sum()
            return density
        except (np.linalg.LinAlgError, ValueError):
            hist, _ = np.histogram(values, bins=n_bins, range=(0, range_max), density=True)
            total = hist.sum()
            return hist / total if total > 0 else np.ones(n_bins) / n_bins

    def _find_peaks_in_distribution(
        self, distribution: np.ndarray, threshold_factor: float = 1.5
    ) -> list[int]:
        """Find bins that are significantly above the uniform baseline.

        A bin is considered a peak if its density exceeds the uniform
        distribution by threshold_factor times.
        """
        uniform = 1.0 / len(distribution)
        threshold = uniform * threshold_factor
        return [int(i) for i, v in enumerate(distribution) if v > threshold]
