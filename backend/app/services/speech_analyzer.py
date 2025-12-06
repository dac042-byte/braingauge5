"""
Speech Analysis Service using OpenAI Whisper API
Extracts speech features for drift calculation
"""
import os
import re
import tempfile
from typing import Dict, Tuple
from openai import OpenAI
import numpy as np


class SpeechAnalyzer:
    """
    Analyzes speech recordings using OpenAI Whisper API.
    Extracts features like words per minute, filler words, pauses, etc.
    """

    # Common filler words to detect
    FILLER_WORDS = {
        'um', 'uh', 'er', 'ah', 'like', 'you know', 'basically',
        'actually', 'literally', 'right', 'so', 'well', 'i mean',
        'kind of', 'sort of', 'okay so', 'yeah', 'hmm'
    }

    def __init__(self):
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        self.client = OpenAI(api_key=api_key)

    async def analyze_audio(
        self,
        audio_data: bytes,
        filename: str = "recording.m4a"
    ) -> Tuple[str, Dict]:
        """
        Analyze audio recording and extract speech features.

        Args:
            audio_data: Raw audio bytes
            filename: Original filename (for format detection)

        Returns:
            Tuple of (transcript, features_dict)
        """
        # Determine file extension
        ext = filename.split('.')[-1] if '.' in filename else 'm4a'

        # Save to temp file for Whisper API
        with tempfile.NamedTemporaryFile(suffix=f'.{ext}', delete=False) as tmp:
            tmp.write(audio_data)
            tmp_path = tmp.name

        try:
            # Transcribe with Whisper - request word timestamps
            with open(tmp_path, 'rb') as audio_file:
                response = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="verbose_json",
                    timestamp_granularities=["word"]
                )

            transcript = response.text
            duration = response.duration if hasattr(response, 'duration') else self._estimate_duration(len(audio_data))

            # Extract features from transcript and word timings
            features = self._extract_features(
                transcript=transcript,
                duration=duration,
                words=response.words if hasattr(response, 'words') else None
            )

            return transcript, features

        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def _extract_features(
        self,
        transcript: str,
        duration: float,
        words: list = None
    ) -> Dict:
        """
        Extract speech features from transcript and timing data.
        """
        # Clean and tokenize transcript
        text_lower = transcript.lower()
        word_list = re.findall(r'\b\w+\b', text_lower)
        word_count = len(word_list)

        # Calculate words per minute
        duration_minutes = max(duration / 60, 0.01)  # Avoid division by zero
        words_per_minute = word_count / duration_minutes

        # Count filler words
        filler_count = 0
        for filler in self.FILLER_WORDS:
            filler_count += text_lower.count(filler)

        filler_ratio = filler_count / max(word_count, 1)

        # Analyze pauses from word timings
        pause_data = self._analyze_pauses(words, duration)

        # Calculate speech rate variability
        variability = self._calculate_rate_variability(words, duration)

        return {
            'words_per_minute': round(words_per_minute, 1),
            'filler_word_count': filler_count,
            'filler_word_ratio': round(filler_ratio, 4),
            'average_pause_length': round(pause_data['avg_pause'], 3),
            'total_pause_time': round(pause_data['total_pause'], 2),
            'word_count': word_count,
            'duration_seconds': round(duration, 2),
            'speech_rate_variability': round(variability, 3)
        }

    def _analyze_pauses(self, words: list, total_duration: float) -> Dict:
        """
        Analyze pause patterns from word timing data.
        """
        if not words or len(words) < 2:
            # Estimate if no word timing available
            return {
                'avg_pause': 0.3,
                'total_pause': total_duration * 0.2,  # Estimate 20% pause
                'pause_count': 0
            }

        pauses = []
        for i in range(1, len(words)):
            # Gap between end of previous word and start of current
            prev_end = words[i-1].get('end', 0)
            curr_start = words[i].get('start', 0)
            gap = curr_start - prev_end

            # Count as pause if > 0.2 seconds
            if gap > 0.2:
                pauses.append(gap)

        if not pauses:
            return {
                'avg_pause': 0.2,
                'total_pause': 0.5,
                'pause_count': 0
            }

        return {
            'avg_pause': np.mean(pauses),
            'total_pause': sum(pauses),
            'pause_count': len(pauses)
        }

    def _calculate_rate_variability(self, words: list, total_duration: float) -> float:
        """
        Calculate variability in speech rate across the recording.
        Higher variability may indicate cognitive load.
        """
        if not words or len(words) < 10:
            return 0.1  # Default low variability

        # Calculate speaking rate in 5-second windows
        window_size = 5.0
        rates = []

        window_start = 0
        while window_start < total_duration:
            window_end = window_start + window_size
            words_in_window = sum(
                1 for w in words
                if w.get('start', 0) >= window_start and w.get('start', 0) < window_end
            )
            if words_in_window > 0:
                rate = words_in_window / (window_size / 60)  # Words per minute
                rates.append(rate)
            window_start += window_size

        if len(rates) < 2:
            return 0.1

        # Return coefficient of variation
        mean_rate = np.mean(rates)
        if mean_rate == 0:
            return 0.1

        return np.std(rates) / mean_rate

    def _estimate_duration(self, file_size: int) -> float:
        """
        Estimate audio duration from file size.
        Rough estimate: ~16KB per second for compressed audio
        """
        return file_size / 16000
