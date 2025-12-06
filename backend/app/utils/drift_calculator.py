"""
Drift Score Calculation Engine
Compares current metrics to Week 1 baseline to calculate drift scores
"""
import numpy as np
from typing import Dict, Optional


class DriftCalculator:
    """
    Calculates drift scores comparing current performance to baseline.
    Higher score = greater drift from baseline (0-100 scale)
    """

    # Weights for Neuro Load Score calculation
    SPEECH_WEIGHT = 0.35
    COGNITIVE_WEIGHT = 0.40
    VISUAL_WEIGHT = 0.25

    @staticmethod
    def calculate_speech_drift(
        current: Dict,
        baseline: Dict
    ) -> float:
        """
        Calculate Speech Drift Score based on multiple factors.

        Factors considered:
        - Words per minute deviation
        - Filler word ratio change
        - Pause pattern changes
        - Speech rate variability
        """
        if not baseline:
            return 0.0  # No drift if this is baseline

        # Calculate individual component drifts
        wpm_drift = DriftCalculator._calculate_deviation(
            current.get('words_per_minute', 0),
            baseline.get('words_per_minute', 1),
            sensitivity=0.3  # 30% change = significant
        )

        filler_drift = DriftCalculator._calculate_deviation(
            current.get('filler_word_ratio', 0),
            baseline.get('filler_word_ratio', 0.01),
            sensitivity=0.5,  # Filler words can vary more
            invert=False  # Higher filler ratio = worse
        )

        pause_drift = DriftCalculator._calculate_deviation(
            current.get('average_pause_length', 0),
            baseline.get('average_pause_length', 0.1),
            sensitivity=0.4
        )

        variability_drift = DriftCalculator._calculate_deviation(
            current.get('speech_rate_variability', 0),
            baseline.get('speech_rate_variability', 0.1),
            sensitivity=0.5
        )

        # Weighted combination
        drift_score = (
            wpm_drift * 0.30 +
            filler_drift * 0.25 +
            pause_drift * 0.25 +
            variability_drift * 0.20
        )

        return min(100.0, max(0.0, drift_score))

    @staticmethod
    def calculate_cognitive_drift(
        current: Dict,
        baseline: Dict
    ) -> float:
        """
        Calculate Cognitive Drift Score.

        Factors:
        - Reaction time changes
        - Accuracy changes
        - N-back performance
        - Response time variability
        """
        if not baseline:
            return 0.0

        # Reaction time drift (slower = more drift)
        rt_drift = DriftCalculator._calculate_deviation(
            current.get('avg_reaction_time', 0),
            baseline.get('avg_reaction_time', 1),
            sensitivity=0.25,
            invert=False  # Higher RT = worse
        )

        # Accuracy drift (lower accuracy = more drift)
        accuracy_drift = DriftCalculator._calculate_inverse_deviation(
            current.get('reaction_accuracy', 100),
            baseline.get('reaction_accuracy', 100),
            sensitivity=0.1  # Accuracy is sensitive
        )

        # N-back accuracy drift
        nback_drift = DriftCalculator._calculate_inverse_deviation(
            current.get('n_back_accuracy', 100),
            baseline.get('n_back_accuracy', 100),
            sensitivity=0.15
        )

        # N-back response time drift
        nback_rt_drift = DriftCalculator._calculate_deviation(
            current.get('n_back_avg_response_time', 0),
            baseline.get('n_back_avg_response_time', 1),
            sensitivity=0.3,
            invert=False
        )

        # Variability drift
        var_drift = DriftCalculator._calculate_deviation(
            current.get('reaction_time_variability', 0),
            baseline.get('reaction_time_variability', 1),
            sensitivity=0.4,
            invert=False
        )

        # Weighted combination
        drift_score = (
            rt_drift * 0.25 +
            accuracy_drift * 0.25 +
            nback_drift * 0.25 +
            nback_rt_drift * 0.15 +
            var_drift * 0.10
        )

        return min(100.0, max(0.0, drift_score))

    @staticmethod
    def calculate_visual_drift(
        current: Dict,
        baseline: Dict
    ) -> float:
        """
        Calculate Visual-Motor Drift Score.

        Factors:
        - Tracking accuracy
        - Tracking smoothness
        - Blink rate changes
        - Deviation frequency
        """
        if not baseline:
            return 0.0

        # Tracking accuracy drift
        accuracy_drift = DriftCalculator._calculate_inverse_deviation(
            current.get('tracking_accuracy', 100),
            baseline.get('tracking_accuracy', 100),
            sensitivity=0.15
        )

        # Smoothness drift
        smoothness_drift = DriftCalculator._calculate_inverse_deviation(
            current.get('tracking_smoothness', 100),
            baseline.get('tracking_smoothness', 100),
            sensitivity=0.2
        )

        # Blink rate drift (significant change in either direction = drift)
        blink_drift = DriftCalculator._calculate_deviation(
            current.get('blink_rate', 0),
            baseline.get('blink_rate', 15),  # Normal: ~15-20 blinks/min
            sensitivity=0.4
        )

        # Deviation frequency drift
        deviation_drift = DriftCalculator._calculate_deviation(
            current.get('deviation_frequency', 0),
            baseline.get('deviation_frequency', 0.1),
            sensitivity=0.5,
            invert=False  # More deviations = worse
        )

        # Weighted combination
        drift_score = (
            accuracy_drift * 0.35 +
            smoothness_drift * 0.25 +
            blink_drift * 0.15 +
            deviation_drift * 0.25
        )

        return min(100.0, max(0.0, drift_score))

    @staticmethod
    def calculate_neuro_load_score(
        speech_drift: Optional[float],
        cognitive_drift: Optional[float],
        visual_drift: Optional[float]
    ) -> float:
        """
        Calculate combined Neuro Load Score from individual drift scores.
        Uses weighted average with available scores.
        """
        scores = []
        weights = []

        if speech_drift is not None:
            scores.append(speech_drift)
            weights.append(DriftCalculator.SPEECH_WEIGHT)

        if cognitive_drift is not None:
            scores.append(cognitive_drift)
            weights.append(DriftCalculator.COGNITIVE_WEIGHT)

        if visual_drift is not None:
            scores.append(visual_drift)
            weights.append(DriftCalculator.VISUAL_WEIGHT)

        if not scores:
            return 0.0

        # Normalize weights
        total_weight = sum(weights)
        normalized_weights = [w / total_weight for w in weights]

        # Calculate weighted average
        neuro_load = sum(s * w for s, w in zip(scores, normalized_weights))

        return min(100.0, max(0.0, neuro_load))

    @staticmethod
    def get_status(neuro_load_score: float) -> str:
        """
        Get status category based on Neuro Load Score.
        """
        if neuro_load_score < 20:
            return "optimal"
        elif neuro_load_score < 40:
            return "moderate"
        elif neuro_load_score < 60:
            return "elevated"
        else:
            return "high"

    @staticmethod
    def _calculate_deviation(
        current: float,
        baseline: float,
        sensitivity: float = 0.3,
        invert: bool = True
    ) -> float:
        """
        Calculate deviation score between current and baseline.

        Args:
            current: Current measurement
            baseline: Baseline measurement
            sensitivity: How sensitive to changes (0.3 = 30% change = significant)
            invert: If True, deviation in either direction is bad
        """
        if baseline == 0:
            baseline = 0.001  # Avoid division by zero

        percent_change = abs(current - baseline) / abs(baseline)

        # Scale to 0-100 based on sensitivity
        score = (percent_change / sensitivity) * 50

        return min(100.0, score)

    @staticmethod
    def _calculate_inverse_deviation(
        current: float,
        baseline: float,
        sensitivity: float = 0.1
    ) -> float:
        """
        Calculate drift where lower current values = higher drift.
        Used for accuracy metrics.
        """
        if baseline == 0:
            baseline = 0.001

        # If current is lower, that's bad
        if current < baseline:
            decrease = (baseline - current) / baseline
            score = (decrease / sensitivity) * 50
        else:
            # Current is same or better - minimal drift
            score = 0

        return min(100.0, score)
