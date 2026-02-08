from fastapi import APIRouter, HTTPException
from app.models import InteractionRequest, AIResponse
from app.services.langchain_service import InterviewAgent

router = APIRouter()

# Initialize LangChain Agent
agent = InterviewAgent()

@router.post("/interact", response_model=AIResponse)
async def interact(request: InteractionRequest):
    """
    Main loop: Receives candidate input + emotion -> Returns AI response.
    """
    try:
        response_text = await agent.generate_response(
            request.transcript, 
            request.emotion_label
        )
        
        return AIResponse(
            text=response_text,
            emotion_context="neutral", 
            next_round_trigger=False
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/report/{session_id}")
async def generate_report(session_id: str):
    try:
        report = await agent.generate_report(session_id)
        return {"report": report}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
