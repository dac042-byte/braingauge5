"""
Scoring Endpoints
GET /score/weekly - Get combined Neuro Load Score
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime

from app.services.storage import storage
from app.utils.drift_calculator import DriftCalculator
from app.models.schemas import WeeklyScore

router = APIRouter()


@router.get("/weekly/{user_id}", response_model=WeeklyScore)
async def get_weekly_score(user_id: str):
    """
    Get combined Neuro Load Score for current week.

    Combines:
    - Speech Drift Score (35% weight)
    - Cognitive Drift Score (40% weight)
    - Visual-Motor Drift Score (25% weight)
    """
    week_data = storage.get_current_week_data(user_id)

    if not week_data:
        raise HTTPException(
            status_code=404,
            detail="No assessment data found for current week"
        )

    scores = week_data.get('scores', {})

    if not scores:
        raise HTTPException(
            status_code=400,
            detail="No assessments completed this week"
        )

    # Get individual drift scores
    speech_drift = scores.get('speech')
    cognitive_drift = scores.get('cognitive')
    visual_drift = scores.get('visual')

    # Calculate combined Neuro Load Score
    neuro_load_score = DriftCalculator.calculate_neuro_load_score(
        speech_drift=speech_drift,
        cognitive_drift=cognitive_drift,
        visual_drift=visual_drift
    )

    # Get status
    status = DriftCalculator.get_status(neuro_load_score)

    return WeeklyScore(
        week_number=week_data.get('week_number', 1),
        speech_drift_score=speech_drift,
        cognitive_drift_score=cognitive_drift,
        visual_motor_drift_score=visual_drift,
        neuro_load_score=round(neuro_load_score, 1),
        status=status,
        timestamp=datetime.utcnow()
    )


@router.post("/finalize/{user_id}")
async def finalize_week(user_id: str):
    """
    Finalize the current week's assessment and add to history.
    Should be called after all assessments are complete.
    """
    week_data = storage.get_current_week_data(user_id)

    if not week_data:
        raise HTTPException(
            status_code=404,
            detail="No assessment data found"
        )

    scores = week_data.get('scores', {})

    # Calculate final score
    neuro_load_score = DriftCalculator.calculate_neuro_load_score(
        speech_drift=scores.get('speech'),
        cognitive_drift=scores.get('cognitive'),
        visual_drift=scores.get('visual')
    )

    status = DriftCalculator.get_status(neuro_load_score)

    # Save to history
    storage.finalize_week(user_id, neuro_load_score, status)

    return {
        "message": "Week finalized successfully",
        "week_number": week_data.get('week_number', 1),
        "neuro_load_score": round(neuro_load_score, 1),
        "status": status
    }


@router.get("/status/{user_id}")
async def get_assessment_status(user_id: str):
    """
    Get current assessment completion status.
    Returns which assessments have been completed this week.
    """
    week_data = storage.get_current_week_data(user_id)
    has_baseline = storage.has_baseline(user_id)

    if not week_data:
        return {
            "user_id": user_id,
            "has_baseline": has_baseline,
            "week_number": 1 if not has_baseline else storage._get_current_week_number(user_id),
            "completed": {
                "speech": False,
                "cognitive": False,
                "visual": False
            },
            "all_complete": False
        }

    scores = week_data.get('scores', {})

    completed = {
        "speech": 'speech' in scores,
        "cognitive": 'cognitive' in scores,
        "visual": 'visual' in scores
    }

    return {
        "user_id": user_id,
        "has_baseline": has_baseline,
        "week_number": week_data.get('week_number', 1),
        "completed": completed,
        "all_complete": all(completed.values()),
        "scores": scores
    }
