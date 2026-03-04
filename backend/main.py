from __future__ import annotations

from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.fraud_detector import FraudDetector
from app.storage import ScanStorage


app = FastAPI(title="Fraud Shield API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


detector = FraudDetector()
storage = ScanStorage()


class AnalyzeRequest(BaseModel):
    message: str = Field(..., min_length=1)


class AnalyzeResponse(BaseModel):
    fraud_probability: int
    risk_level: str
    fraud_type: str
    suspicious_keywords: List[str]
    patterns: List[str]
    explanation: str
    safety_tips: List[str]
    cybercrime_helpline: str
    cybercrime_website: str


class SpamTypeItem(BaseModel):
    label: str
    value: int


class StatsResponse(BaseModel):
    total: int
    spam: int
    normal: int
    top_spam_types: List[SpamTypeItem]
    latest_normal: List[str]
    latest_spam: List[str]


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest) -> dict:
    result = detector.analyze(req.message)
    storage.save_scan(req.message, result)
    return result


@app.get("/stats", response_model=StatsResponse)
def stats() -> dict:
    return storage.stats()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
