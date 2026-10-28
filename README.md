# 🎙 Phoneme Forge — AI Pronunciation Coach

A full-stack web application for live pronunciation scoring. Speak into your microphone, get an instant AI score and detailed coaching feedback powered by OpenAI Whisper and Groq LLaMA-3.

---

## ✨ Features

- **Live Microphone Recording** — Web Audio API with real-time waveform visualisation
- **Whisper Transcription** — OpenAI Whisper converts your speech to text accurately
- **Multi-Dimensional Scoring** — Accuracy (55%), Fluency (25%), Completeness (20%)
- **Word-Level Diff** — See exactly which words you nailed, missed, or substituted
- **AI Coach Feedback** — Groq LLaMA-3 generates personalised tips and improvements
- **Firebase Auth** — Sign in with email/password or Google
- **Glowing Cursor Trail** — Custom amber cursor with particle sparks
- **Anti-Gravity Mode** — Google Gravity-inspired physics with draggable elements
- **Three.js Hero** — Animated neural particle field on the homepage
- **Session History** — Track your scores and streaks within a session

---

## 📁 Project Structure

```
phoneme-forge/
│
├── backend/
│   ├── main.py                  # FastAPI server, all routes
│   ├── pronunciation_service.py # Whisper transcription + scoring
│   ├── feedback_generator.py    # Groq LLM + rule-based fallback
│   ├── requirements.txt
│   └── .env                     # Your API keys go here
│
└── frontend/
    ├── index.html               # Landing page (Three.js hero)
    ├── login.html               # Firebase auth page
    ├── app.html                 # Main practice room
    ├── firebase-config.js       # Firebase credentials
    ├── css/
    │   └── styles.css           # Full design system
    └── js/
        ├── app.js               # Recording, API calls, score display
        ├── cursor.js            # Glowing cursor + trail
        └── antigravity.js       # Physics gravity simulation
```

---

## 🚀 Quick Start

### 1. Clone / extract the project

```bash
cd phoneme-forge
```

### 2. Set up the Python virtual environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

> **Note on PyTorch**: If `pip install -r requirements.txt` fails for torch, install it separately:
> ```bash
> pip install torch --index-url https://download.pytorch.org/whl/cpu
> pip install openai-whisper torchaudio
> ```

### 4. Configure API keys

Edit `backend/.env`:

```env
GROQ_API_KEY=your_groq_api_key_here
WHISPER_MODEL=base
```

Get your free Groq API key at: https://console.groq.com

**Whisper model options** (tradeoff: speed vs accuracy):
- `tiny`   — fastest, least accurate
- `base`   — good balance (recommended)
- `small`  — more accurate, slower
- `medium` — best accuracy, requires more RAM

### 5. Configure Firebase (optional but recommended)

1. Go to https://console.firebase.google.com → New project
2. Add a Web app → copy the config object
3. Open `frontend/firebase-config.js` and replace all `YOUR_*` values
4. In Firebase Console → Authentication → Get Started → enable Email/Password and Google

> **Without Firebase**: The app still works fully — authentication just won't redirect. Users can click "Continue without account" on the login page.

### 6. Run the server

```bash
# From the backend/ directory
python -m uvicorn main:app --reload

# Or from the project root
python -m uvicorn backend.main:app --reload
```

Server starts at: **http://127.0.0.1:8000**

---

## 📖 Using the App

1. Open **http://127.0.0.1:8000**
2. Click **"Launch Practice Room"** or navigate to `/app`
3. Select a reference sentence from the sidebar (or type your own)
4. Click **⏺ Start Recording** and speak the sentence clearly
5. Click **⏹ Stop & Analyze** when done
6. Wait ~3–10 seconds for Whisper + AI analysis
7. View your score, word diff, and AI coaching feedback!

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/health` | Server health check |
| `GET`  | `/api/reference-sentences` | Get practice sentences |
| `POST` | `/api/record-audio` | Upload audio file, returns session_id |
| `POST` | `/api/analyze-pronunciation` | Full pipeline: transcribe → score → feedback |
| `GET`  | `/api/score/{session_id}` | Retrieve cached session results |

### Example: Analyze pronunciation

```bash
# 1. Upload audio
curl -X POST http://localhost:8000/api/record-audio \
  -F "audio=@my_recording.wav"

# Response: {"session_id": "abc123", "file_size": 45632, "status": "received"}

# 2. Analyze
curl -X POST http://localhost:8000/api/analyze-pronunciation \
  -F "session_id=abc123" \
  -F "reference=Speech therapy helps people improve communication."
```

---

## 🎨 Design System

- **Aesthetic**: Deep void neural interface — obsidian blacks, electric amber, ice whites
- **Fonts**: Syne (display) + JetBrains Mono (data/mono) + Outfit (body)
- **Cursor**: Custom amber glow cursor with particle spark trail (Three.js-free, canvas-based)
- **Hero BG**: Three.js particle field with neural connection lines and animated voice ring
- **Anti-Gravity**: Physics simulation — elements fall, bounce, and can be dragged

---

## 🐛 Troubleshooting

**`No module named 'fastapi'`**
```bash
# Make sure venv is activated
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

**Whisper takes too long / OOM error**
```env
# In .env, switch to a smaller model
WHISPER_MODEL=tiny
```

**Microphone not working**
- Open browser Console (F12) for errors
- Ensure you've granted microphone permissions
- Try Chrome or Edge (best Web Audio API support)

**Firebase auth errors**
- Check that credentials in `firebase-config.js` are correct
- Ensure Email/Password and Google are enabled in Firebase Console
- Add `localhost` to Firebase Authorized Domains

**Score always 0**
- Speak louder and closer to the microphone
- Ensure a quiet environment
- Check that the recording file is not empty (check backend logs)

---

## 🔧 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `fastapi` | 0.111.0 | Web framework |
| `uvicorn` | 0.30.1 | ASGI server |
| `openai-whisper` | 20231117 | Speech-to-text |
| `torch` | 2.3.0 | PyTorch (Whisper dependency) |
| `groq` | 0.9.0 | LLaMA-3 AI feedback |
| `librosa` | 0.10.2 | Audio processing |
| `jiwer` | 3.0.4 | Speech similarity metrics |
| `python-dotenv` | 1.0.1 | Environment variables |
| `python-multipart` | 0.0.9 | File upload handling |

**Frontend CDNs** (no npm needed):
- Three.js r128 — hero particle animation
- Google Fonts — Syne + JetBrains Mono + Outfit
- Firebase JS SDK 10.12.2 — authentication
