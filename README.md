# BrainGauge - Cognitive Performance Tracker for Athletes

A mobile app that tracks cognitive changes in athletes through weekly assessments. **NOT a medical device** - purely for performance monitoring and trend awareness.

## Features

### Core Assessment Modules

1. **Speech Analysis** (20-60 sec)
   - Read passages aloud for transcription
   - Measures: words/min, filler words, pause patterns, speech rate
   - Calculates Speech Drift Score (0-100)

2. **Cognitive Tests** (~2 min)
   - Reaction time test (10 trials)
   - 2-back working memory test (20 trials)
   - Calculates Cognitive Drift Score (0-100)

3. **Visual-Motor Tracking** (~30 sec)
   - Follow moving dot with finger
   - Track blink rate and accuracy
   - Calculates Visual-Motor Drift Score (0-100)

### Scoring System
- **Neuro Load Score**: Weighted average of all drift scores
  - Speech: 35% weight
  - Cognitive: 40% weight
  - Visual: 25% weight
- Week 1 = baseline for all metrics
- Higher score = greater drift from baseline
- Status levels: Optimal (<20), Moderate (20-40), Elevated (40-60), High (>60)

### Screens
- **Check-In**: Start weekly assessments
- **Dashboard**: Line graph of history, color-coded status
- **Insights**: Trend analysis and personalized recommendations
- **Profile**: Settings, data export, baseline reset

---

## Project Structure

```
braingauge5/
├── backend/                 # Python FastAPI server
│   ├── app/
│   │   ├── main.py         # FastAPI app entry point
│   │   ├── models/         # Pydantic schemas
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   └── utils/          # Drift calculator
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/               # React Native Expo app
│   ├── App.tsx            # App entry point
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── context/       # App state management
│   │   ├── navigation/    # React Navigation setup
│   │   ├── screens/       # App screens
│   │   ├── services/      # API client
│   │   ├── types/         # TypeScript definitions
│   │   └── utils/         # Theme and helpers
│   ├── assets/            # App icons and splash
│   ├── app.json           # Expo configuration
│   └── package.json
│
└── README.md
```

---

## Startup Guide

### Prerequisites

- **Node.js** 18+ and npm/yarn
- **Python** 3.9+
- **Expo Go** app on your iOS/Android device
- **OpenAI API key** (for Whisper speech-to-text)

### Step 1: Set Up the Backend

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with your OpenAI API key
cp .env.example .env
```

**Edit the `.env` file:**
```
OPENAI_API_KEY=sk-your-openai-api-key-here
```

**Start the backend server:**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://localhost:8000`

### Step 2: Set Up the Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Expo development server
npx expo start
```

### Step 3: Run on Your Device

1. Install **Expo Go** from App Store (iOS) or Google Play (Android)
2. Scan the QR code shown in your terminal with Expo Go
3. The app will load on your device

### Step 4: Configure Server URL

If running on a physical device, you need to update the server URL:

1. Find your computer's local IP address:
   - macOS: `ifconfig | grep "inet " | grep -v 127.0.0.1`
   - Windows: `ipconfig`
   - Linux: `hostname -I`

2. In the app, go to **Profile** tab
3. Tap the server URL and change to: `http://YOUR_IP:8000`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/audio/upload` | Upload speech recording for analysis |
| POST | `/cognitive/submit` | Submit cognitive test results |
| POST | `/visual/submit` | Submit visual tracking results |
| GET | `/score/weekly/{user_id}` | Get combined Neuro Load Score |
| GET | `/score/status/{user_id}` | Get assessment completion status |
| POST | `/score/finalize/{user_id}` | Finalize week and save to history |
| GET | `/history/{user_id}` | Get all weekly history |
| GET | `/history/{user_id}/trends` | Get trend analysis |
| GET | `/history/{user_id}/export` | Export all user data |
| DELETE | `/history/{user_id}/reset` | Reset baseline data |

---

## Testing the Full Flow

### Complete Assessment Flow

1. **Open the app** and navigate to Check-In tab
2. **Speech Assessment**:
   - Tap "Start Assessment" on Speech Analysis
   - Read the displayed passage aloud for 30-60 seconds
   - Tap "Stop Recording"
   - Wait for analysis (uses OpenAI Whisper)
   - View your Speech Drift Score

3. **Cognitive Assessment**:
   - Tap "Start Assessment" on Cognitive Tests
   - **Reaction Test**: Tap the circle as fast as possible when it appears (10 trials)
   - **2-Back Test**: Tap when current shape matches the shape from 2 steps ago (20 trials)
   - View your Cognitive Drift Score

4. **Visual Assessment**:
   - Tap "Start Assessment" on Visual Tracking
   - Follow the moving dot with your finger for 30 seconds
   - Tap "Blink" button whenever you blink
   - View your Visual-Motor Drift Score

5. **Complete the Week**:
   - After all 3 assessments, tap "Complete Week"
   - View your combined Neuro Load Score on Dashboard

### Verify Backend

```bash
# Check health
curl http://localhost:8000/health

# Check API docs
open http://localhost:8000/docs
```

---

## Building for Production

### Expo EAS Build (Recommended)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

### App Icons and Splash

Before building, add your app assets to `frontend/assets/`:
- `icon.png` - 1024x1024 (App Store icon)
- `splash.png` - 1284x2778 (Splash screen)
- `adaptive-icon.png` - 1024x1024 (Android adaptive icon)
- `favicon.png` - 48x48 (Web)

### Backend Deployment

For production, deploy the backend to a cloud provider:

1. **Railway/Render/Fly.io** (easiest)
2. **AWS/GCP/Azure** (scalable)
3. **Docker**:
   ```dockerfile
   FROM python:3.11-slim
   WORKDIR /app
   COPY requirements.txt .
   RUN pip install -r requirements.txt
   COPY app ./app
   CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
   ```

---

## Development Notes

### Offline Support
- Assessments work offline (data stored locally)
- Syncs with backend when connection is available
- Profile shows connection status

### Error Handling
- All API calls have timeout and retry logic
- User-friendly error messages
- Loading states for async operations

### Data Privacy
- User IDs are randomly generated (no PII required)
- All data can be exported or deleted
- No data is shared with third parties

---

## Troubleshooting

### "Network request failed"
- Ensure backend is running
- Check server URL in Profile settings
- Verify your device is on the same network as your computer

### "Microphone permission denied"
- Go to device Settings > BrainGauge > Enable Microphone

### "Recording too short"
- Record for at least 20 seconds for speech analysis

### Backend crashes with OpenAI error
- Verify your OPENAI_API_KEY is valid
- Check you have API credits available

---

## Contributing

This is a performance awareness tool, not a medical device. Contributions should maintain this distinction and avoid making medical claims.

## License

MIT License - See LICENSE file for details.

---

**Important Disclaimer**: BrainGauge is designed for performance awareness and is NOT a medical device. It should not be used to diagnose, treat, or prevent any medical condition. Always consult healthcare professionals for medical concerns.
