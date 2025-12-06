"""
BrainGauge Backend - Cognitive Performance Tracker API
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routes import audio, cognitive, visual, score, history

load_dotenv()

app = FastAPI(
    title="BrainGauge API",
    description="Cognitive Performance Tracker for Athletes",
    version="1.0.0"
)

# CORS middleware for React Native
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(audio.router, prefix="/audio", tags=["Audio Analysis"])
app.include_router(cognitive.router, prefix="/cognitive", tags=["Cognitive Tests"])
app.include_router(visual.router, prefix="/visual", tags=["Visual-Motor Tests"])
app.include_router(score.router, prefix="/score", tags=["Scoring"])
app.include_router(history.router, prefix="/history", tags=["History"])


@app.get("/")
async def root():
    return {
        "message": "BrainGauge API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
