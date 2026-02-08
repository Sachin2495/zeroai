from pydantic import BaseModel
from typing import List, Optional

class CandidateCreate(BaseModel):
    name: str = "Candidate"
    role: str
    resume_text: Optional[str] = None

class InterviewSessionCreate(BaseModel):
    candidate_id: int
    role: str

class InteractionRequest(BaseModel):
    session_id: str
    transcript: str
    emotion_label: str
    emotion_score: float

class AIResponse(BaseModel):
    text: str
    audio_base64: Optional[str] = None
    emotion_context: str
    next_round_trigger: bool = False
