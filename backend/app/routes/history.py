"""
History Endpoints
GET /history - Get all weekly assessment history
"""
from fastapi import APIRouter, HTTPException
from typing import List

from app.services.storage import storage
from app.models.schemas import HistoryEntry

router = APIRouter()


@router.get("/{user_id}", response_model=List[HistoryEntry])
async def get_history(user_id: str):
    """
    Get all weekly assessment history for a user.
    Returns list of weekly scores sorted by week number.
    """
    history = storage.get_history(user_id)

    if not history:
        return []

    # Sort by week number
    sorted_history = sorted(history, key=lambda x: x['week_number'])

    return [
        HistoryEntry(
            week_number=entry['week_number'],
            date=entry['date'],
            neuro_load_score=entry['neuro_load_score'],
            speech_drift=entry.get('speech_drift'),
            cognitive_drift=entry.get('cognitive_drift'),
            visual_drift=entry.get('visual_drift'),
            status=entry['status']
        )
        for entry in sorted_history
    ]


@router.get("/{user_id}/export")
async def export_data(user_id: str):
    """
    Export all user data including baselines and history.
    Useful for data portability and backup.
    """
    data = storage.export_user_data(user_id)
    return data


@router.delete("/{user_id}/reset")
async def reset_baseline(user_id: str):
    """
    Reset user's baseline data.
    Next assessment will establish new baselines.
    """
    storage.reset_baseline(user_id)
    return {
        "message": "Baseline reset successfully",
        "user_id": user_id,
        "next_week": 1
    }


@router.get("/{user_id}/trends")
async def get_trends(user_id: str):
    """
    Get trend analysis for user's performance over time.
    """
    history = storage.get_history(user_id)

    if len(history) < 2:
        return {
            "user_id": user_id,
            "has_trends": False,
            "message": "Need at least 2 weeks of data for trends"
        }

    sorted_history = sorted(history, key=lambda x: x['week_number'])

    # Calculate trends
    neuro_scores = [h['neuro_load_score'] for h in sorted_history]
    speech_scores = [h.get('speech_drift', 0) for h in sorted_history if h.get('speech_drift') is not None]
    cognitive_scores = [h.get('cognitive_drift', 0) for h in sorted_history if h.get('cognitive_drift') is not None]
    visual_scores = [h.get('visual_drift', 0) for h in sorted_history if h.get('visual_drift') is not None]

    def calculate_trend(scores):
        if len(scores) < 2:
            return "stable"
        recent_avg = sum(scores[-3:]) / len(scores[-3:])
        earlier_avg = sum(scores[:-3] or scores[:1]) / len(scores[:-3] or scores[:1])
        diff = recent_avg - earlier_avg
        if diff > 5:
            return "increasing"
        elif diff < -5:
            return "decreasing"
        return "stable"

    def find_most_changed(history):
        if len(history) < 2:
            return None
        last = history[-1]
        prev = history[-2]

        changes = {}
        if last.get('speech_drift') is not None and prev.get('speech_drift') is not None:
            changes['speech'] = abs(last['speech_drift'] - prev['speech_drift'])
        if last.get('cognitive_drift') is not None and prev.get('cognitive_drift') is not None:
            changes['cognitive'] = abs(last['cognitive_drift'] - prev['cognitive_drift'])
        if last.get('visual_drift') is not None and prev.get('visual_drift') is not None:
            changes['visual'] = abs(last['visual_drift'] - prev['visual_drift'])

        if not changes:
            return None

        return max(changes, key=changes.get)

    return {
        "user_id": user_id,
        "has_trends": True,
        "weeks_analyzed": len(sorted_history),
        "overall_trend": calculate_trend(neuro_scores),
        "speech_trend": calculate_trend(speech_scores) if speech_scores else None,
        "cognitive_trend": calculate_trend(cognitive_scores) if cognitive_scores else None,
        "visual_trend": calculate_trend(visual_scores) if visual_scores else None,
        "most_changed_area": find_most_changed(sorted_history),
        "current_status": sorted_history[-1]['status'],
        "average_neuro_load": round(sum(neuro_scores) / len(neuro_scores), 1)
    }
