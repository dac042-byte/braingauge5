"""
Audio Analysis Endpoint
POST /audio/upload - Analyze speech recording
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from datetime import datetime

from app.services.speech_analyzer import SpeechAnalyzer
from app.services.storage import storage
from app.utils.drift_calculator import DriftCalculator
from app.models.schemas import SpeechAnalysisResult, SpeechFeatures

router = APIRouter()


@router.post("/upload", response_model=SpeechAnalysisResult)
async def upload_audio(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    is_baseline: bool = Form(False)
):
    """
    Upload and analyze speech recording.

    - Transcribes audio using OpenAI Whisper
    - Extracts speech features (WPM, filler words, pauses)
    - Calculates drift score compared to baseline
    """
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Read file content
    try:
        audio_data = await file.read()
        if len(audio_data) < 1000:
            raise HTTPException(status_code=400, detail="Audio file too small")
        if len(audio_data) > 25 * 1024 * 1024:  # 25MB limit
            raise HTTPException(status_code=400, detail="Audio file too large (max 25MB)")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")

    # Analyze audio
    try:
        analyzer = SpeechAnalyzer()
        transcript, features = await analyzer.analyze_audio(audio_data, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Speech analysis failed: {str(e)}")

    # Handle baseline vs regular assessment
    if is_baseline or not storage.get_speech_baseline(user_id):
        # This is baseline - save it
        storage.save_speech_baseline(user_id, features)
        drift_score = 0.0
        is_baseline = True
    else:
        # Calculate drift from baseline
        baseline = storage.get_speech_baseline(user_id)
        drift_score = DriftCalculator.calculate_speech_drift(features, baseline)

    # Save current week score
    storage.save_current_week_score(
        user_id=user_id,
        score_type='speech',
        score=drift_score,
        details=features
    )

    return SpeechAnalysisResult(
        features=SpeechFeatures(**features),
        drift_score=drift_score,
        is_baseline=is_baseline,
        timestamp=datetime.utcnow(),
        transcript=transcript
    )


@router.get("/baseline/{user_id}")
async def get_baseline(user_id: str):
    """Get speech baseline for a user."""
    baseline = storage.get_speech_baseline(user_id)
    if not baseline:
        raise HTTPException(status_code=404, detail="No baseline found")
    return {"baseline": baseline, "user_id": user_id}
