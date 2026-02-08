from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    
    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

class CandidateModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: Optional[str] = None
    email: Optional[str] = None
    role: str
    domain: str
    resume_text: str
    resume_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class InterviewSessionModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    candidate_id: str
    quiz_score: Optional[float] = None
    quiz_answers: Optional[list] = None
    interview_transcript: list = []
    emotion_data: list = []
    final_score: Optional[float] = None
    report: Optional[dict] = None
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
