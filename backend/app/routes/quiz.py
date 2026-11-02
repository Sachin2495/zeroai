from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.services.langchain_service import InterviewAgent
from app.db.config import get_candidates_collection, find_candidate, id_query

router = APIRouter()

class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correct_index: int

class QuizRequest(BaseModel):
    domain: str
    resume_text: Optional[str] = None
    candidate_id: Optional[str] = None

class QuizResponse(BaseModel):
    questions: List[QuizQuestion]

class QuizResultPayload(BaseModel):
    quiz_score: float
    total_questions: int = 10
    correct_count: int = 0

@router.post("/api/generate-quiz", response_model=QuizResponse)
async def generate_quiz(request: QuizRequest):
    """
    Generate 10 quiz questions based on resume and domain (using candidate_id if provided).
    """
    try:
        resume_text = request.resume_text
        if request.candidate_id:
            candidate = await find_candidate(request.candidate_id)
            if candidate and candidate.get("resume_text"):
                resume_text = candidate["resume_text"]

        if not resume_text:
            resume_text = f"Experienced {request.domain} developer with various technical skills."

        agent = InterviewAgent()
        questions = await agent.generate_quiz(resume_text, request.domain)
        return QuizResponse(questions=questions)
    except Exception as e:
        print(f"Quiz Generation Route Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/candidate/{candidate_id}/quiz-result")
async def save_quiz_result(candidate_id: str, payload: QuizResultPayload):
    """
    Saves candidate's preliminary quiz score directly to MongoDB Atlas.
    """
    try:
        candidates_col = get_candidates_collection()
        query = id_query(candidate_id)
        existing = await candidates_col.find_one(query)
        if not existing:
            raise HTTPException(status_code=404, detail="Candidate not found")
        if existing.get("status") == "completed":
            raise HTTPException(status_code=409, detail="This interview has already been completed")

        # Calculate preliminary technical score from quiz (weighted baseline)
        baseline_tech = round(payload.quiz_score * 0.35, 1)

        await candidates_col.update_one(
            query,
            {"$set": {
                "quiz_score": float(payload.quiz_score),
                "quiz_total": payload.total_questions,
                "quiz_correct": payload.correct_count,
                "quiz_completed_at": datetime.utcnow().isoformat(),
                "technical_score": baseline_tech
            }}
        )

        return {
            "status": "success",
            "candidate_id": candidate_id,
            "quiz_score": payload.quiz_score,
            "baseline_tech_score": baseline_tech
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Saving quiz score failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
