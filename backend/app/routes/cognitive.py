"""
Cognitive Tests Endpoint
POST /cognitive/submit - Submit cognitive test results
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime
import numpy as np

from app.services.storage import storage
from app.utils.drift_calculator import DriftCalculator
from app.models.schemas import CognitiveTestData, CognitiveResult

router = APIRouter()


@router.post("/submit", response_model=CognitiveResult)
async def submit_cognitive_results(data: CognitiveTestData):
    """
    Submit cognitive test results and calculate drift score.

    Tests include:
    - Reaction time test
    - 2-back working memory test
    """
    # Validate input
    if len(data.reaction_times) < 5:
        raise HTTPException(
            status_code=400,
            detail="At least 5 reaction time measurements required"
        )

    if data.n_back_total < 10:
        raise HTTPException(
            status_code=400,
            detail="At least 10 n-back trials required"
        )

    # Calculate metrics
    reaction_times = np.array(data.reaction_times)
    avg_reaction_time = float(np.mean(reaction_times))
    reaction_time_variability = float(np.std(reaction_times))
    n_back_accuracy = (data.n_back_correct / data.n_back_total) * 100

    # Prepare current metrics
    current_metrics = {
        'avg_reaction_time': avg_reaction_time,
        'reaction_time_variability': reaction_time_variability,
        'reaction_accuracy': data.reaction_accuracy,
        'n_back_accuracy': n_back_accuracy,
        'n_back_avg_response_time': data.n_back_avg_response_time
    }

    # Handle baseline vs regular assessment
    baseline = storage.get_cognitive_baseline(data.user_id)

    if data.is_baseline or not baseline:
        # This is baseline - save it
        storage.save_cognitive_baseline(data.user_id, current_metrics)
        drift_score = 0.0
        is_baseline = True
    else:
        # Calculate drift from baseline
        drift_score = DriftCalculator.calculate_cognitive_drift(current_metrics, baseline)
        is_baseline = False

    # Save current week score
    storage.save_current_week_score(
        user_id=data.user_id,
        score_type='cognitive',
        score=drift_score,
        details=current_metrics
    )

    return CognitiveResult(
        avg_reaction_time=avg_reaction_time,
        reaction_time_variability=reaction_time_variability,
        reaction_accuracy=data.reaction_accuracy,
        n_back_accuracy=n_back_accuracy,
        n_back_avg_response_time=data.n_back_avg_response_time,
        cognitive_drift_score=drift_score,
        is_baseline=is_baseline,
        timestamp=datetime.utcnow()
    )


@router.get("/baseline/{user_id}")
async def get_cognitive_baseline(user_id: str):
    """Get cognitive baseline for a user."""
    baseline = storage.get_cognitive_baseline(user_id)
    if not baseline:
        raise HTTPException(status_code=404, detail="No baseline found")
    return {"baseline": baseline, "user_id": user_id}
