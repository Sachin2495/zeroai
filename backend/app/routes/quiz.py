from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from app.services.langchain_service import InterviewAgent

router = APIRouter()

class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correct_index: int

class QuizRequest(BaseModel):
    domain: str
    resume_text: str

class QuizResponse(BaseModel):
    questions: List[QuizQuestion]

@router.post("/api/generate-quiz", response_model=QuizResponse)
async def generate_quiz(request: QuizRequest):
    """
    Generate 10 quiz questions based on resume and domain.
    """
    try:
        agent = InterviewAgent()
        questions = await agent.generate_quiz(request.resume_text, request.domain)
        return QuizResponse(questions=questions)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
