# Technocrats Innovation Challenge - Heisenbugs

AI-assisted dementia care platform for live calls, voice summarization, and caregiver support.

## What this project does

- Runs a 2-person WebRTC video call (caregiver and guest/client).
- Records call audio in chunks and sends it to an LLM pipeline.
- Produces live rolling summaries and a final session summary.
- Captures periodic snapshots from video and stores them in the ML service.
- Includes a bridge service for forwarding face-detection events to SpacetimeDB reducers.

## Architecture

Frontend (Vite + React, port 5173)
- WebRTC UI and signaling client
- Audio chunk upload to LLM backend via /api/* proxy
- Summary polling via /api/summary
- Snapshot upload to ML backend via /ml/snapshot

LLM Backend (FastAPI, port 8001)
- Receives audio chunks
- Whisper STT + Groq summarization
- Redis-backed live summary state
- Session end compilation and optional forwarding to Dev2 bridge URL

ML Service (FastAPI, port 8002)
- Snapshot persistence endpoint
- Health endpoint
- Mock detect/register endpoints in current app implementation

Signaling Server (Node + socket.io, port 4000)
- Room join/leave orchestration
- Offer/answer/ICE exchange for WebRTC peers

Bridge Service (Python)
- Polls ML wait-for-result endpoint
- Calls SpacetimeDB reducers over HTTP
- Tracks last seen person to avoid duplicate updates

## Repository structure

- frontend/: React app, WebRTC UI, summary polling, audio and snapshot clients
- LLM/: FastAPI LLM pipeline, Redis integration, Whisper/Groq services
- ml-service/: FastAPI ML endpoints (currently snapshot + mock detect/register in active code)
- bridge/: Python bridge + Node signaling server
- memorycare-db/: SpacetimeDB package metadata/scripts
- docs/: team setup notes and contracts

## Tech stack

- Frontend: React, TypeScript, Vite, socket.io-client
- LLM service: FastAPI, Redis, whisper, Groq SDK
- ML service: FastAPI, OpenCV/Numpy (plus DeepFace deps in requirements)
- Signaling: Node.js, Express, socket.io
- Bridge: Python, httpx
- Data bridge target: SpacetimeDB HTTP reducers

## Prerequisites

- Node.js 18+
- Python 3.10+
- Redis 7+ (for LLM service)
- FFmpeg available in PATH (required by whisper)
- Optional: SpacetimeDB CLI for full bridge + DB flow

## Environment configuration

### LLM service

Use LLM/.env.example as reference and create LLM/.env.

Required:
- GROQ_API_KEY

Common optional values:
- GROQ_MODEL (default: llama-3.1-8b-instant)
- REDIS_URL (default: redis://localhost:6379/0)
- LOG_LEVEL
- CORS_ORIGINS
- DEV2_SUMMARY_BRIDGE_URL (if forwarding final summary externally)

### Bridge service

bridge/bridge.py reads:
- ML_API_URL (defaults to an ngrok URL in code)

For local usage, set ML_API_URL to your local ML endpoint or bridge-compatible endpoint.

## Install and run (recommended order)

Open separate terminals from repository root.

1. Start Redis (required for LLM)

```powershell
redis-server
```

2. Start LLM backend (port 8001)

```powershell
cd LLM
pip install -r requirements.txt
python run.py
```

3. Start ML service (port 8002)

```powershell
cd ml-service
pip install -r requirements.txt
python run.py
```

4. Start signaling server (port 4000)

```powershell
cd bridge
npm install
node signaling-server.js
```

5. Start frontend (port 5173)

```powershell
cd frontend
npm install
npm run dev
```

6. Optional: start bridge service (SpacetimeDB integration path)

```powershell
cd bridge
pip install -r requirements.txt
python bridge.py
```

7. Optional: expose app externally with one tunnel

```powershell
cloudflared tunnel --url http://localhost:5173
```

The frontend Vite proxy already routes:
- /api -> http://localhost:8001
- /ml -> http://localhost:8002
- /socket.io -> http://localhost:4000

## Service endpoints

Frontend
- http://localhost:5173

LLM backend
- GET /health
- POST /api/audio
- GET /api/summary?session_id=...
- POST /api/session/end
- GET /api/past-summaries?client_id=...&limit=...

ML service
- GET /health
- POST /snapshot (via frontend proxy as /ml/snapshot)
- POST /detect
- POST /register

Signaling server
- GET /health
- socket.io signaling at /socket.io

## Current behavior notes

- Dashboard creates a unique session id per session and starts recording only after remote peer connection is established.
- Voice chunks are sent sequentially through a queue to reduce tunnel congestion.
- SnapshotCapture stores files in ml-service/client_snaps and ML service cleanup removes old files automatically.
- LLM audio processing is asynchronous: upload returns quickly while STT + summary runs in background.

## Known docs drift fixed by this README

- Active ML run entrypoint is ml-service/run.py and default port is 8002.
- Frontend relies on Vite proxy paths instead of hardcoded backend host URLs.
- A single cloudflared tunnel to frontend is sufficient for API + signaling paths.

## Additional docs

- docs/setup.md
- docs/api-contracts.md
- LLM/API_CONTRACTS.md
