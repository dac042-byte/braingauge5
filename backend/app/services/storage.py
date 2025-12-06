"""
In-Memory Storage Service for BrainGauge
In production, this would be replaced with a database
"""
from typing import Dict, Optional, List
from datetime import datetime
import json


class StorageService:
    """
    Simple in-memory storage for baselines and history.
    Data persists only while server is running.
    For production, replace with database (PostgreSQL, MongoDB, etc.)
    """

    _instance = None
    _baselines: Dict[str, Dict] = {}
    _history: Dict[str, List[Dict]] = {}
    _current_week: Dict[str, Dict] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def save_speech_baseline(self, user_id: str, features: Dict) -> None:
        """Save speech baseline for a user."""
        if user_id not in self._baselines:
            self._baselines[user_id] = {}
        self._baselines[user_id]['speech'] = {
            **features,
            'created_at': datetime.utcnow().isoformat()
        }

    def get_speech_baseline(self, user_id: str) -> Optional[Dict]:
        """Get speech baseline for a user."""
        return self._baselines.get(user_id, {}).get('speech')

    def save_cognitive_baseline(self, user_id: str, data: Dict) -> None:
        """Save cognitive test baseline for a user."""
        if user_id not in self._baselines:
            self._baselines[user_id] = {}
        self._baselines[user_id]['cognitive'] = {
            **data,
            'created_at': datetime.utcnow().isoformat()
        }

    def get_cognitive_baseline(self, user_id: str) -> Optional[Dict]:
        """Get cognitive baseline for a user."""
        return self._baselines.get(user_id, {}).get('cognitive')

    def save_visual_baseline(self, user_id: str, data: Dict) -> None:
        """Save visual tracking baseline for a user."""
        if user_id not in self._baselines:
            self._baselines[user_id] = {}
        self._baselines[user_id]['visual'] = {
            **data,
            'created_at': datetime.utcnow().isoformat()
        }

    def get_visual_baseline(self, user_id: str) -> Optional[Dict]:
        """Get visual baseline for a user."""
        return self._baselines.get(user_id, {}).get('visual')

    def save_current_week_score(
        self,
        user_id: str,
        score_type: str,
        score: float,
        details: Dict = None
    ) -> None:
        """Save a score for the current week."""
        if user_id not in self._current_week:
            self._current_week[user_id] = {
                'week_number': self._get_current_week_number(user_id),
                'scores': {},
                'details': {}
            }

        self._current_week[user_id]['scores'][score_type] = score
        if details:
            self._current_week[user_id]['details'][score_type] = details

    def get_current_week_data(self, user_id: str) -> Optional[Dict]:
        """Get current week's data for a user."""
        return self._current_week.get(user_id)

    def finalize_week(self, user_id: str, neuro_load_score: float, status: str) -> None:
        """Finalize current week and add to history."""
        if user_id not in self._current_week:
            return

        week_data = self._current_week[user_id]
        history_entry = {
            'week_number': week_data['week_number'],
            'date': datetime.utcnow().isoformat(),
            'neuro_load_score': neuro_load_score,
            'speech_drift': week_data['scores'].get('speech'),
            'cognitive_drift': week_data['scores'].get('cognitive'),
            'visual_drift': week_data['scores'].get('visual'),
            'status': status,
            'details': week_data.get('details', {})
        }

        if user_id not in self._history:
            self._history[user_id] = []

        # Check if this week already exists
        existing_idx = None
        for i, entry in enumerate(self._history[user_id]):
            if entry['week_number'] == week_data['week_number']:
                existing_idx = i
                break

        if existing_idx is not None:
            self._history[user_id][existing_idx] = history_entry
        else:
            self._history[user_id].append(history_entry)

        # Reset current week for next assessment
        self._current_week[user_id] = {
            'week_number': week_data['week_number'] + 1,
            'scores': {},
            'details': {}
        }

    def get_history(self, user_id: str) -> List[Dict]:
        """Get all history for a user."""
        return self._history.get(user_id, [])

    def reset_baseline(self, user_id: str) -> None:
        """Reset all baselines for a user."""
        if user_id in self._baselines:
            del self._baselines[user_id]
        if user_id in self._current_week:
            self._current_week[user_id] = {
                'week_number': 1,
                'scores': {},
                'details': {}
            }

    def has_baseline(self, user_id: str) -> bool:
        """Check if user has any baseline data."""
        baseline = self._baselines.get(user_id, {})
        return bool(baseline.get('speech') or baseline.get('cognitive') or baseline.get('visual'))

    def _get_current_week_number(self, user_id: str) -> int:
        """Get current week number for a user."""
        history = self._history.get(user_id, [])
        if not history:
            return 1
        return max(h['week_number'] for h in history) + 1

    def export_user_data(self, user_id: str) -> Dict:
        """Export all data for a user."""
        return {
            'user_id': user_id,
            'baselines': self._baselines.get(user_id, {}),
            'history': self._history.get(user_id, []),
            'current_week': self._current_week.get(user_id, {}),
            'exported_at': datetime.utcnow().isoformat()
        }


# Singleton instance
storage = StorageService()
