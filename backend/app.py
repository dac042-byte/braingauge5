"""
BrainGauge Backend - Simple Flask Server
Run with: python app.py
"""
import os
import re
import tempfile
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import numpy as np

load_dotenv()

app = Flask(__name__)
CORS(app)

# ============== IN-MEMORY STORAGE ==============
baselines = {}
history = {}
current_week = {}

# ============== DRIFT CALCULATOR ==============
SPEECH_WEIGHT = 0.35
COGNITIVE_WEIGHT = 0.40
VISUAL_WEIGHT = 0.25

def calculate_deviation(current, baseline, sensitivity=0.3):
    if baseline == 0:
        baseline = 0.001
    percent_change = abs(current - baseline) / abs(baseline)
    score = (percent_change / sensitivity) * 50
    return min(100.0, score)

def calculate_inverse_deviation(current, baseline, sensitivity=0.1):
    if baseline == 0:
        baseline = 0.001
    if current < baseline:
        decrease = (baseline - current) / baseline
        score = (decrease / sensitivity) * 50
    else:
        score = 0
    return min(100.0, score)

def calculate_speech_drift(current, baseline):
    if not baseline:
        return 0.0
    wpm_drift = calculate_deviation(current.get('words_per_minute', 0), baseline.get('words_per_minute', 1), 0.3)
    filler_drift = calculate_deviation(current.get('filler_word_ratio', 0), baseline.get('filler_word_ratio', 0.01), 0.5)
    pause_drift = calculate_deviation(current.get('average_pause_length', 0), baseline.get('average_pause_length', 0.1), 0.4)
    var_drift = calculate_deviation(current.get('speech_rate_variability', 0), baseline.get('speech_rate_variability', 0.1), 0.5)
    return min(100.0, max(0.0, wpm_drift * 0.30 + filler_drift * 0.25 + pause_drift * 0.25 + var_drift * 0.20))

def calculate_cognitive_drift(current, baseline):
    if not baseline:
        return 0.0
    rt_drift = calculate_deviation(current.get('avg_reaction_time', 0), baseline.get('avg_reaction_time', 1), 0.25)
    acc_drift = calculate_inverse_deviation(current.get('reaction_accuracy', 100), baseline.get('reaction_accuracy', 100), 0.1)
    nback_drift = calculate_inverse_deviation(current.get('n_back_accuracy', 100), baseline.get('n_back_accuracy', 100), 0.15)
    nback_rt_drift = calculate_deviation(current.get('n_back_avg_response_time', 0), baseline.get('n_back_avg_response_time', 1), 0.3)
    var_drift = calculate_deviation(current.get('reaction_time_variability', 0), baseline.get('reaction_time_variability', 1), 0.4)
    return min(100.0, max(0.0, rt_drift * 0.25 + acc_drift * 0.25 + nback_drift * 0.25 + nback_rt_drift * 0.15 + var_drift * 0.10))

def calculate_visual_drift(current, baseline):
    if not baseline:
        return 0.0
    acc_drift = calculate_inverse_deviation(current.get('tracking_accuracy', 100), baseline.get('tracking_accuracy', 100), 0.15)
    smooth_drift = calculate_inverse_deviation(current.get('tracking_smoothness', 100), baseline.get('tracking_smoothness', 100), 0.2)
    blink_drift = calculate_deviation(current.get('blink_rate', 0), baseline.get('blink_rate', 15), 0.4)
    dev_drift = calculate_deviation(current.get('deviation_frequency', 0), baseline.get('deviation_frequency', 0.1), 0.5)
    return min(100.0, max(0.0, acc_drift * 0.35 + smooth_drift * 0.25 + blink_drift * 0.15 + dev_drift * 0.25))

def calculate_neuro_load(speech, cognitive, visual):
    scores = []
    weights = []
    if speech is not None:
        scores.append(speech)
        weights.append(SPEECH_WEIGHT)
    if cognitive is not None:
        scores.append(cognitive)
        weights.append(COGNITIVE_WEIGHT)
    if visual is not None:
        scores.append(visual)
        weights.append(VISUAL_WEIGHT)
    if not scores:
        return 0.0
    total_weight = sum(weights)
    normalized = [w / total_weight for w in weights]
    return min(100.0, max(0.0, sum(s * w for s, w in zip(scores, normalized))))

def get_status(score):
    if score < 20:
        return "optimal"
    elif score < 40:
        return "moderate"
    elif score < 60:
        return "elevated"
    return "high"

# ============== SPEECH ANALYZER ==============
FILLER_WORDS = {'um', 'uh', 'er', 'ah', 'like', 'you know', 'basically', 'actually', 'literally', 'right', 'so', 'well', 'i mean', 'kind of', 'sort of', 'okay so', 'yeah', 'hmm'}

def analyze_speech(audio_data, filename):
    """Analyze audio using OpenAI Whisper"""
    from openai import OpenAI

    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set in .env file")

    client = OpenAI(api_key=api_key)
    ext = filename.split('.')[-1] if '.' in filename else 'm4a'

    with tempfile.NamedTemporaryFile(suffix=f'.{ext}', delete=False) as tmp:
        tmp.write(audio_data)
        tmp_path = tmp.name

    try:
        with open(tmp_path, 'rb') as audio_file:
            response = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                timestamp_granularities=["word"]
            )

        transcript = response.text
        duration = response.duration if hasattr(response, 'duration') else len(audio_data) / 16000
        words = response.words if hasattr(response, 'words') else None

        # Extract features
        text_lower = transcript.lower()
        word_list = re.findall(r'\b\w+\b', text_lower)
        word_count = len(word_list)
        duration_minutes = max(duration / 60, 0.01)
        words_per_minute = word_count / duration_minutes

        filler_count = sum(text_lower.count(f) for f in FILLER_WORDS)
        filler_ratio = filler_count / max(word_count, 1)

        # Pause analysis
        avg_pause = 0.3
        total_pause = duration * 0.2
        if words and len(words) >= 2:
            pauses = []
            for i in range(1, len(words)):
                gap = words[i].get('start', 0) - words[i-1].get('end', 0)
                if gap > 0.2:
                    pauses.append(gap)
            if pauses:
                avg_pause = np.mean(pauses)
                total_pause = sum(pauses)

        # Rate variability
        variability = 0.1
        if words and len(words) >= 10:
            window_size = 5.0
            rates = []
            window_start = 0
            while window_start < duration:
                window_end = window_start + window_size
                words_in_window = sum(1 for w in words if w.get('start', 0) >= window_start and w.get('start', 0) < window_end)
                if words_in_window > 0:
                    rates.append(words_in_window / (window_size / 60))
                window_start += window_size
            if len(rates) >= 2:
                mean_rate = np.mean(rates)
                if mean_rate > 0:
                    variability = np.std(rates) / mean_rate

        features = {
            'words_per_minute': round(words_per_minute, 1),
            'filler_word_count': filler_count,
            'filler_word_ratio': round(filler_ratio, 4),
            'average_pause_length': round(avg_pause, 3),
            'total_pause_time': round(total_pause, 2),
            'word_count': word_count,
            'duration_seconds': round(duration, 2),
            'speech_rate_variability': round(variability, 3)
        }

        return transcript, features
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

# ============== ROUTES ==============

@app.route('/')
def index():
    return jsonify({"message": "BrainGauge API", "version": "1.0.0", "status": "running"})

@app.route('/health')
def health():
    return jsonify({"status": "healthy"})

# ----- AUDIO -----
@app.route('/audio/upload', methods=['POST'])
def upload_audio():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']
    user_id = request.form.get('user_id', 'default_user')
    is_baseline = request.form.get('is_baseline', 'false').lower() == 'true'

    audio_data = file.read()
    if len(audio_data) < 1000:
        return jsonify({"error": "Audio file too small"}), 400

    try:
        transcript, features = analyze_speech(audio_data, file.filename or 'recording.m4a')
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    # Handle baseline
    baseline = baselines.get(user_id, {}).get('speech')
    if is_baseline or not baseline:
        if user_id not in baselines:
            baselines[user_id] = {}
        baselines[user_id]['speech'] = features
        drift_score = 0.0
        is_baseline = True
    else:
        drift_score = calculate_speech_drift(features, baseline)

    # Save current week score
    if user_id not in current_week:
        current_week[user_id] = {'week_number': get_week_number(user_id), 'scores': {}, 'details': {}}
    current_week[user_id]['scores']['speech'] = drift_score
    current_week[user_id]['details']['speech'] = features

    return jsonify({
        "features": features,
        "drift_score": round(drift_score, 1),
        "is_baseline": is_baseline,
        "timestamp": datetime.utcnow().isoformat(),
        "transcript": transcript
    })

# ----- COGNITIVE -----
@app.route('/cognitive/submit', methods=['POST'])
def submit_cognitive():
    data = request.json
    user_id = data.get('user_id', 'default_user')
    is_baseline = data.get('is_baseline', False)

    reaction_times = data.get('reaction_times', [])
    if len(reaction_times) < 5:
        return jsonify({"error": "At least 5 reaction times required"}), 400

    avg_rt = float(np.mean(reaction_times))
    rt_var = float(np.std(reaction_times))
    n_back_accuracy = (data.get('n_back_correct', 0) / max(data.get('n_back_total', 1), 1)) * 100

    current_metrics = {
        'avg_reaction_time': avg_rt,
        'reaction_time_variability': rt_var,
        'reaction_accuracy': data.get('reaction_accuracy', 100),
        'n_back_accuracy': n_back_accuracy,
        'n_back_avg_response_time': data.get('n_back_avg_response_time', 1000)
    }

    baseline = baselines.get(user_id, {}).get('cognitive')
    if is_baseline or not baseline:
        if user_id not in baselines:
            baselines[user_id] = {}
        baselines[user_id]['cognitive'] = current_metrics
        drift_score = 0.0
        is_baseline = True
    else:
        drift_score = calculate_cognitive_drift(current_metrics, baseline)

    if user_id not in current_week:
        current_week[user_id] = {'week_number': get_week_number(user_id), 'scores': {}, 'details': {}}
    current_week[user_id]['scores']['cognitive'] = drift_score
    current_week[user_id]['details']['cognitive'] = current_metrics

    return jsonify({
        "avg_reaction_time": round(avg_rt, 1),
        "reaction_time_variability": round(rt_var, 1),
        "reaction_accuracy": data.get('reaction_accuracy', 100),
        "n_back_accuracy": round(n_back_accuracy, 1),
        "n_back_avg_response_time": data.get('n_back_avg_response_time', 1000),
        "cognitive_drift_score": round(drift_score, 1),
        "is_baseline": is_baseline,
        "timestamp": datetime.utcnow().isoformat()
    })

# ----- VISUAL -----
@app.route('/visual/submit', methods=['POST'])
def submit_visual():
    data = request.json
    user_id = data.get('user_id', 'default_user')
    is_baseline = data.get('is_baseline', False)

    test_duration = data.get('test_duration_seconds', 30)
    if test_duration < 10:
        return jsonify({"error": "Test duration must be at least 10 seconds"}), 400

    duration_minutes = test_duration / 60
    blink_rate = data.get('blink_count', 0) / duration_minutes if duration_minutes > 0 else 0
    deviation_freq = data.get('deviation_events', 0) / duration_minutes if duration_minutes > 0 else 0

    current_metrics = {
        'tracking_accuracy': data.get('tracking_accuracy', 100),
        'tracking_smoothness': data.get('tracking_smoothness', 100),
        'blink_rate': blink_rate,
        'deviation_frequency': deviation_freq,
        'avg_deviation_distance': data.get('avg_deviation_distance', 0)
    }

    baseline = baselines.get(user_id, {}).get('visual')
    if is_baseline or not baseline:
        if user_id not in baselines:
            baselines[user_id] = {}
        baselines[user_id]['visual'] = current_metrics
        drift_score = 0.0
        is_baseline = True
    else:
        drift_score = calculate_visual_drift(current_metrics, baseline)

    if user_id not in current_week:
        current_week[user_id] = {'week_number': get_week_number(user_id), 'scores': {}, 'details': {}}
    current_week[user_id]['scores']['visual'] = drift_score
    current_week[user_id]['details']['visual'] = current_metrics

    return jsonify({
        "tracking_accuracy": data.get('tracking_accuracy', 100),
        "tracking_smoothness": data.get('tracking_smoothness', 100),
        "blink_rate": round(blink_rate, 1),
        "deviation_frequency": round(deviation_freq, 2),
        "visual_motor_drift_score": round(drift_score, 1),
        "is_baseline": is_baseline,
        "timestamp": datetime.utcnow().isoformat()
    })

# ----- SCORE -----
@app.route('/score/weekly/<user_id>')
def get_weekly_score(user_id):
    week_data = current_week.get(user_id)
    if not week_data or not week_data.get('scores'):
        return jsonify({"error": "No assessment data found"}), 404

    scores = week_data['scores']
    speech = scores.get('speech')
    cognitive = scores.get('cognitive')
    visual = scores.get('visual')

    neuro_load = calculate_neuro_load(speech, cognitive, visual)
    status = get_status(neuro_load)

    return jsonify({
        "week_number": week_data.get('week_number', 1),
        "speech_drift_score": speech,
        "cognitive_drift_score": cognitive,
        "visual_motor_drift_score": visual,
        "neuro_load_score": round(neuro_load, 1),
        "status": status,
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route('/score/status/<user_id>')
def get_status_route(user_id):
    week_data = current_week.get(user_id)
    has_baseline = user_id in baselines and bool(baselines[user_id])

    if not week_data:
        return jsonify({
            "user_id": user_id,
            "has_baseline": has_baseline,
            "week_number": 1,
            "completed": {"speech": False, "cognitive": False, "visual": False},
            "all_complete": False
        })

    scores = week_data.get('scores', {})
    completed = {
        "speech": 'speech' in scores,
        "cognitive": 'cognitive' in scores,
        "visual": 'visual' in scores
    }

    return jsonify({
        "user_id": user_id,
        "has_baseline": has_baseline,
        "week_number": week_data.get('week_number', 1),
        "completed": completed,
        "all_complete": all(completed.values()),
        "scores": scores
    })

@app.route('/score/finalize/<user_id>', methods=['POST'])
def finalize_week(user_id):
    week_data = current_week.get(user_id)
    if not week_data:
        return jsonify({"error": "No assessment data found"}), 404

    scores = week_data.get('scores', {})
    neuro_load = calculate_neuro_load(scores.get('speech'), scores.get('cognitive'), scores.get('visual'))
    status = get_status(neuro_load)

    # Save to history
    entry = {
        'week_number': week_data.get('week_number', 1),
        'date': datetime.utcnow().isoformat(),
        'neuro_load_score': neuro_load,
        'speech_drift': scores.get('speech'),
        'cognitive_drift': scores.get('cognitive'),
        'visual_drift': scores.get('visual'),
        'status': status
    }

    if user_id not in history:
        history[user_id] = []

    # Update or append
    existing = next((i for i, h in enumerate(history[user_id]) if h['week_number'] == entry['week_number']), None)
    if existing is not None:
        history[user_id][existing] = entry
    else:
        history[user_id].append(entry)

    # Reset for next week
    current_week[user_id] = {'week_number': entry['week_number'] + 1, 'scores': {}, 'details': {}}

    return jsonify({
        "message": "Week finalized successfully",
        "week_number": entry['week_number'],
        "neuro_load_score": round(neuro_load, 1),
        "status": status
    })

# ----- HISTORY -----
@app.route('/history/<user_id>')
def get_history(user_id):
    user_history = history.get(user_id, [])
    return jsonify(sorted(user_history, key=lambda x: x['week_number']))

@app.route('/history/<user_id>/trends')
def get_trends(user_id):
    user_history = history.get(user_id, [])

    if len(user_history) < 2:
        return jsonify({
            "user_id": user_id,
            "has_trends": False,
            "message": "Need at least 2 weeks of data"
        })

    sorted_history = sorted(user_history, key=lambda x: x['week_number'])
    neuro_scores = [h['neuro_load_score'] for h in sorted_history]

    def calc_trend(scores):
        if len(scores) < 2:
            return "stable"
        recent = sum(scores[-3:]) / len(scores[-3:])
        earlier = sum(scores[:-3] or scores[:1]) / len(scores[:-3] or scores[:1])
        diff = recent - earlier
        if diff > 5:
            return "increasing"
        elif diff < -5:
            return "decreasing"
        return "stable"

    # Find most changed area
    most_changed = None
    if len(sorted_history) >= 2:
        last, prev = sorted_history[-1], sorted_history[-2]
        changes = {}
        if last.get('speech_drift') is not None and prev.get('speech_drift') is not None:
            changes['speech'] = abs(last['speech_drift'] - prev['speech_drift'])
        if last.get('cognitive_drift') is not None and prev.get('cognitive_drift') is not None:
            changes['cognitive'] = abs(last['cognitive_drift'] - prev['cognitive_drift'])
        if last.get('visual_drift') is not None and prev.get('visual_drift') is not None:
            changes['visual'] = abs(last['visual_drift'] - prev['visual_drift'])
        if changes:
            most_changed = max(changes, key=changes.get)

    return jsonify({
        "user_id": user_id,
        "has_trends": True,
        "weeks_analyzed": len(sorted_history),
        "overall_trend": calc_trend(neuro_scores),
        "most_changed_area": most_changed,
        "current_status": sorted_history[-1]['status'],
        "average_neuro_load": round(sum(neuro_scores) / len(neuro_scores), 1)
    })

@app.route('/history/<user_id>/export')
def export_data(user_id):
    return jsonify({
        "user_id": user_id,
        "baselines": baselines.get(user_id, {}),
        "history": history.get(user_id, []),
        "current_week": current_week.get(user_id, {}),
        "exported_at": datetime.utcnow().isoformat()
    })

@app.route('/history/<user_id>/reset', methods=['DELETE'])
def reset_baseline(user_id):
    if user_id in baselines:
        del baselines[user_id]
    if user_id in current_week:
        current_week[user_id] = {'week_number': 1, 'scores': {}, 'details': {}}
    return jsonify({"message": "Baseline reset successfully", "user_id": user_id})

def get_week_number(user_id):
    user_history = history.get(user_id, [])
    if not user_history:
        return 1
    return max(h['week_number'] for h in user_history) + 1

# ============== RUN ==============
if __name__ == '__main__':
    print("=" * 50)
    print("BrainGauge Backend Server")
    print("=" * 50)
    print("Starting on http://localhost:8000")
    print("Press Ctrl+C to stop")
    print("=" * 50)
    app.run(host='0.0.0.0', port=8000, debug=True)
