"""
Visual-Motor Tracking Endpoint
POST /visual/submit - Submit eye tracking results
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime

from app.services.storage import storage
from app.utils.drift_calculator import DriftCalculator
from app.models.schemas import VisualTrackingData, VisualResult

router = APIRouter()


@router.post("/submit", response_model=VisualResult)
async def submit_visual_results(data: VisualTrackingData):
    """
    Submit visual-motor tracking results and calculate drift score.

    Metrics include:
    - Tracking accuracy
    - Tracking smoothness
    - Blink rate
    - Deviation frequency
    """
    # Validate input
    if data.test_duration_seconds < 10:
        raise HTTPException(
            status_code=400,
            detail="Test duration must be at least 10 seconds"
        )

    # Calculate derived metrics
    test_duration_minutes = data.test_duration_seconds / 60
    blink_rate = data.blink_count / test_duration_minutes if test_duration_minutes > 0 else 0
    deviation_frequency = data.deviation_events / test_duration_minutes if test_duration_minutes > 0 else 0

    # Prepare current metrics
    current_metrics = {
        'tracking_accuracy': data.tracking_accuracy,
        'tracking_smoothness': data.tracking_smoothness,
        'blink_rate': blink_rate,
        'deviation_frequency': deviation_frequency,
        'avg_deviation_distance': data.avg_deviation_distance
    }

    # Handle baseline vs regular assessment
    baseline = storage.get_visual_baseline(data.user_id)

    if data.is_baseline or not baseline:
        # This is baseline - save it
        storage.save_visual_baseline(data.user_id, current_metrics)
        drift_score = 0.0
        is_baseline = True
    else:
        # Calculate drift from baseline
        drift_score = DriftCalculator.calculate_visual_drift(current_metrics, baseline)
        is_baseline = False

    # Save current week score
    storage.save_current_week_score(
        user_id=data.user_id,
        score_type='visual',
        score=drift_score,
        details=current_metrics
    )

    return VisualResult(
        tracking_accuracy=data.tracking_accuracy,
        tracking_smoothness=data.tracking_smoothness,
        blink_rate=round(blink_rate, 1),
        deviation_frequency=round(deviation_frequency, 2),
        visual_motor_drift_score=drift_score,
        is_baseline=is_baseline,
        timestamp=datetime.utcnow()
    )


@router.get("/baseline/{user_id}")
async def get_visual_baseline(user_id: str):
    """Get visual baseline for a user."""
    baseline = storage.get_visual_baseline(user_id)
    if not baseline:
        raise HTTPException(status_code=404, detail="No baseline found")
    return {"baseline": baseline, "user_id": user_id}
