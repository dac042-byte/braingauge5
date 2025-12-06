"""
Pydantic models for BrainGauge API
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class SpeechFeatures(BaseModel):
    """Extracted features from speech analysis"""
    words_per_minute: float = Field(..., description="Speaking rate in words per minute")
    filler_word_count: int = Field(..., description="Number of filler words (um, uh, like, etc.)")
    filler_word_ratio: float = Field(..., description="Ratio of filler words to total words")
    average_pause_length: float = Field(..., description="Average pause duration in seconds")
    total_pause_time: float = Field(..., description="Total pause time in seconds")
    word_count: int = Field(..., description="Total words spoken")
    duration_seconds: float = Field(..., description="Recording duration in seconds")
    speech_rate_variability: float = Field(..., description="Variability in speech rate")


class SpeechAnalysisResult(BaseModel):
    """Result of speech analysis including drift score"""
    features: SpeechFeatures
    drift_score: float = Field(..., ge=0, le=100, description="Speech Drift Score (0-100)")
    is_baseline: bool = Field(default=False, description="Whether this is a baseline measurement")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    transcript: str = Field(..., description="Transcribed text from recording")


class CognitiveTestData(BaseModel):
    """Input data from cognitive tests"""
    reaction_times: List[float] = Field(..., description="List of reaction times in ms")
    reaction_accuracy: float = Field(..., ge=0, le=100, description="Accuracy percentage for reaction test")
    n_back_correct: int = Field(..., description="Number of correct n-back responses")
    n_back_total: int = Field(..., description="Total n-back trials")
    n_back_avg_response_time: float = Field(..., description="Average response time for n-back in ms")
    user_id: str = Field(..., description="User identifier")
    is_baseline: bool = Field(default=False)


class CognitiveResult(BaseModel):
    """Result of cognitive test analysis"""
    avg_reaction_time: float = Field(..., description="Average reaction time in ms")
    reaction_time_variability: float = Field(..., description="Std deviation of reaction times")
    reaction_accuracy: float = Field(..., description="Reaction test accuracy")
    n_back_accuracy: float = Field(..., description="N-back test accuracy percentage")
    n_back_avg_response_time: float = Field(..., description="Average n-back response time")
    cognitive_drift_score: float = Field(..., ge=0, le=100, description="Cognitive Drift Score")
    is_baseline: bool = Field(default=False)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class VisualTrackingData(BaseModel):
    """Input data from eye/visual tracking"""
    tracking_accuracy: float = Field(..., ge=0, le=100, description="How accurately user followed the dot")
    tracking_smoothness: float = Field(..., ge=0, le=100, description="Smoothness of tracking movement")
    blink_count: int = Field(..., description="Number of blinks during test")
    test_duration_seconds: float = Field(..., description="Duration of visual test")
    deviation_events: int = Field(..., description="Number of times user lost track")
    avg_deviation_distance: float = Field(..., description="Average distance from target when deviated")
    user_id: str = Field(..., description="User identifier")
    is_baseline: bool = Field(default=False)


class VisualResult(BaseModel):
    """Result of visual-motor analysis"""
    tracking_accuracy: float
    tracking_smoothness: float
    blink_rate: float = Field(..., description="Blinks per minute")
    deviation_frequency: float = Field(..., description="Deviations per minute")
    visual_motor_drift_score: float = Field(..., ge=0, le=100)
    is_baseline: bool = Field(default=False)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class WeeklyScore(BaseModel):
    """Combined weekly Neuro Load Score"""
    week_number: int
    speech_drift_score: Optional[float] = None
    cognitive_drift_score: Optional[float] = None
    visual_motor_drift_score: Optional[float] = None
    neuro_load_score: float = Field(..., ge=0, le=100, description="Combined weighted score")
    status: str = Field(..., description="Status: optimal, moderate, elevated, high")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class HistoryEntry(BaseModel):
    """Single history entry for tracking over time"""
    week_number: int
    date: datetime
    neuro_load_score: float
    speech_drift: Optional[float] = None
    cognitive_drift: Optional[float] = None
    visual_drift: Optional[float] = None
    status: str


class BaselineData(BaseModel):
    """Baseline measurements for Week 1"""
    user_id: str
    speech_baseline: Optional[SpeechFeatures] = None
    cognitive_baseline: Optional[dict] = None
    visual_baseline: Optional[dict] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
