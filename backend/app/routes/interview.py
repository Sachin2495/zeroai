from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime
import os
from app.models import InteractionRequest, AIResponse
from app.services.langgraph_agent import MultiAgentInterviewer
from app.db.config import get_candidates_collection, find_candidate, id_query
from app.services.jwt_service import (
    create_interview_token,
    verify_interview_token,
    check_admin_credentials,
    create_admin_token,
    require_admin,
)

router = APIRouter()

# Public URL of the frontend, used to build invite links
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
INVITE_EXPIRY_HOURS = int(os.getenv("INVITE_EXPIRY_HOURS", "1"))

# Initialize LangGraph Agent
agent = MultiAgentInterviewer()

class TokenVerifyRequest(BaseModel):
    token: str

class CandidateInviteRequest(BaseModel):
    name: str
    email: str
    role: str
    domain: Optional[str] = "General"

class BulkInviteRequest(BaseModel):
    candidates: List[CandidateInviteRequest]

class AdminLoginRequest(BaseModel):
    username: str
    password: str

class ReportPayload(BaseModel):
    warning_count: Optional[int] = None
    disqualified: Optional[bool] = False
    disqualification_reason: Optional[str] = None
    quiz_score: Optional[float] = None

@router.post("/interact", response_model=AIResponse)
async def interact(request: InteractionRequest):
    """
    Main loop: Receives candidate input + emotion + proctoring metrics -> Runs LangGraph multi-agent flow.
    """
    try:
        # Retrieve candidate session data
        candidates_col = get_candidates_collection()
        candidate = await find_candidate(request.session_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Interview session not found")
        if candidate.get("status") == "completed":
            raise HTTPException(status_code=409, detail="This interview has already been completed")

        # Formulate last emotion and telemetry payload
        last_emotion = {
            "label": request.emotion_label,
            "score": request.emotion_score,
            "gaze_direction": request.gaze_direction,
            "face_present": request.face_present,
            "tab_switch_alert": request.tab_switch_alert
        }

        # Run multi-agent graph
        result = await agent.interact(
            session_id=request.session_id,
            transcript=request.transcript,
            last_emotion=last_emotion,
            candidate_info=candidate,
            chat_history=candidate.get("chat_history", [])
        )

        clean_resp = result.get("response_text", "Could you elaborate further on that architecture?")

        # Update candidate state in database
        updated_history = candidate.get("chat_history", []) + [
            {"role": "user", "content": request.transcript},
            {"role": "assistant", "content": clean_resp}
        ]
        
        tech_score = result.get("technical_score", candidate.get("technical_score", 0.0))
        evals = result.get("evaluations", candidate.get("evaluations", []))
        cheat_warnings = result.get("cheat_warnings", candidate.get("cheat_warnings", 0))

        update_data = {
            "chat_history": updated_history,
            "cheat_warnings": cheat_warnings,
            "technical_score": tech_score,
            "evaluations": evals,
            "current_question": result.get("current_question", clean_resp)
        }

        await candidates_col.update_one(id_query(request.session_id), {"$set": update_data})

        return AIResponse(
            text=clean_resp,
            emotion_context=result.get("last_emotion", {}).get("label", "neutral"),
            next_round_trigger=cheat_warnings >= 3
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Interact Route Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/report/{session_id}")
async def generate_report(session_id: str, payload: Optional[ReportPayload] = None):
    """
    Generates a structured, production-ready assessment report based on multi-agent logs.
    """
    try:
        candidates_col = get_candidates_collection()
        candidate = await find_candidate(session_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Interview session not found")
        # Reports are final once written; a reload or double submit must not re-score
        if candidate.get("status") == "completed" and candidate.get("report"):
            return candidate["report"]

        # Synchronize warnings from frontend telemetry
        frontend_warnings = payload.warning_count if payload and payload.warning_count is not None else None
        if frontend_warnings is not None:
            warnings = max(frontend_warnings, candidate.get("cheat_warnings", 0))
        else:
            warnings = candidate.get("cheat_warnings", 0)

        disqualified = False
        if (payload and payload.disqualified) or warnings >= 3:
            disqualified = True

        # Retrieve quiz score (from payload or candidate record)
        quiz_score = 0.0
        if payload and payload.quiz_score is not None:
            quiz_score = float(payload.quiz_score)
        elif candidate.get("quiz_score") is not None:
            quiz_score = float(candidate.get("quiz_score", 0.0))

        evaluations = candidate.get("evaluations", [])
        answered_questions = len(evaluations)
        
        # Calculate technical score from evaluations + quiz
        if answered_questions > 0:
            eval_scores = [ev.get("score", 0.0) for ev in evaluations]
            interview_score = round(sum(eval_scores) / len(eval_scores), 1)
            # 35% quiz + 65% interview
            tech_score = round(0.35 * quiz_score + 0.65 * interview_score, 1)
        else:
            interview_score = 0.0
            # If no interview questions answered, only the quiz contribution counts
            tech_score = round(0.35 * quiz_score, 1)
        
        # Penalize for proctoring violations (10 points per flag)
        penalty = warnings * 10.0
        final_score = max(0, min(100, round(tech_score - penalty)))
        
        strengths = []
        weaknesses = []
        
        for ev in evaluations:
            q_snippet = (ev.get("question", "")[:60] + "...") if len(ev.get("question", "")) > 60 else ev.get("question", "")
            if ev.get("score", 0.0) >= 78:
                strengths.append(f"Strong understanding of topics related to: {q_snippet}")
            elif ev.get("score", 0.0) < 65:
                weaknesses.append(f"Needs clarification on: {q_snippet}")
                
        strengths = list(set(strengths))[:3]
        weaknesses = list(set(weaknesses))[:3]
        
        if answered_questions == 0:
            weaknesses.append("Did not answer technical questions during live interview.")
        elif not strengths:
            strengths = [
                "Demonstrated active technical engagement and logical structuring.",
                "Completed verbal interview questions with professional clarity."
            ]
        if not weaknesses:
            weaknesses = ["Could provide deeper low-level algorithmic trade-off analysis."]
            
        if warnings > 0:
            weaknesses.append(f"Flagged {warnings} time(s) for off-screen gaze or browser tab switching.")
            
        role_title = candidate.get("role", "Software Engineer")
        if disqualified or warnings >= 3:
            final_score = min(final_score, 30)
            recommendation = "No Hire (Integrity Alert)"
            summary = (
                f"Assessment auto-terminated due to integrity policy violations ({warnings}/3 flags). "
                f"Quiz: {quiz_score:.0f}%, Interview: {interview_score:.0f}%, Final: {final_score}/100."
            )
        elif answered_questions == 0:
            recommendation = "No Hire (Incomplete Interview)"
            summary = (
                f"Candidate scored {quiz_score:.0f}% on the screening quiz, but did not answer any questions "
                f"during the live technical interview. Overall score: {final_score}/100."
            )
        elif final_score >= 80 and warnings <= 1:
            recommendation = "Strong Hire"
            summary = (
                f"Candidate demonstrated exceptional competency for {role_title}. "
                f"Quiz: {quiz_score:.0f}%, Live Interview: {interview_score:.0f}%, Flags: {warnings}. Final score: {final_score}/100."
            )
        elif final_score >= 68 and warnings <= 1:
            recommendation = "Hire"
            summary = (
                f"Candidate met all technical thresholds for {role_title}. "
                f"Quiz: {quiz_score:.0f}%, Live Interview: {interview_score:.0f}%, Flags: {warnings}. Final score: {final_score}/100."
            )
        elif final_score >= 50:
            recommendation = "Consider"
            summary = (
                f"Candidate showed baseline aptitude for {role_title}. "
                f"Quiz: {quiz_score:.0f}%, Live Interview: {interview_score:.0f}%, Flags: {warnings}. Final score: {final_score}/100."
            )
        else:
            recommendation = "No Hire"
            summary = (
                f"Candidate score fell below the hiring threshold for {role_title}. "
                f"Quiz: {quiz_score:.0f}%, Live Interview: {interview_score:.0f}%, Flags: {warnings}. Final score: {final_score}/100."
            )
        
        report_data = {
            "overall_score": int(final_score),
            "technical_score": float(tech_score),
            "quiz_score": float(quiz_score),
            "interview_score": float(interview_score),
            "answered_questions": answered_questions,
            "warning_count": int(warnings),
            "disqualified": disqualified,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "summary": summary,
            "recommendation": recommendation,
            "completed_at": datetime.utcnow().isoformat()
        }
        
        # Persist report into candidate record
        update_data = {
            "report": report_data,
            "final_score": int(final_score),
            "technical_score": float(tech_score),
            "quiz_score": float(quiz_score),
            "cheat_warnings": int(warnings),
            "disqualified": disqualified,
            "status": "completed",
            "completed_at": datetime.utcnow().isoformat()
        }
        
        await candidates_col.update_one(id_query(session_id), {"$set": update_data})
        
        return report_data
    except HTTPException:
        raise
    except Exception as e:
        print(f"Report Generation Route Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# RECRUITER / ADMIN PORTAL ENDPOINTS
# ==========================================

@router.post("/admin/login")
async def admin_login(req: AdminLoginRequest):
    """Exchanges admin credentials (ADMIN_USERNAME / ADMIN_PASSWORD env) for a 12-hour admin token."""
    if not check_admin_credentials(req.username, req.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"token": create_admin_token(req.username.strip().lower()), "expires_in": 12 * 3600}

@router.get("/admin/candidates")
async def get_all_candidates(admin: dict = Depends(require_admin)):
    """
    Retrieves all candidate interview records for recruiter dashboard.
    """
    try:
        candidates_col = get_candidates_collection()
        cursor = candidates_col.find({}, {"resume_base64": 0}).sort("_id", -1)
        items = await cursor.to_list(length=500)
        
        results = []
        for doc in items:
            c_id = str(doc.get("_id", ""))
            report = doc.get("report") or {}
            
            final_score = doc.get("final_score")
            if final_score is None:
                final_score = report.get("overall_score", 70)
                
            tech_score = doc.get("technical_score")
            if tech_score is None:
                tech_score = report.get("technical_score", 0.0)
                
            results.append({
                "candidate_id": c_id,
                "name": doc.get("name") or "Candidate",
                "email": doc.get("email") or "",
                "role": doc.get("role", "Software Engineer"),
                "domain": doc.get("domain", "General"),
                "final_score": int(final_score),
                "technical_score": float(tech_score),
                "cheat_warnings": doc.get("cheat_warnings", report.get("warning_count", 0)),
                "disqualified": doc.get("disqualified", report.get("disqualified", False)),
                "status": doc.get("status", "completed"),
                "recommendation": report.get("recommendation", "Completed"),
                "summary": report.get("summary", ""),
                "resume_filename": doc.get("resume_filename", "resume.pdf"),
                "created_at": doc.get("created_at") or doc.get("completed_at") or ""
            })
            
        return results
    except Exception as e:
        print(f"Admin candidates list error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/candidates/{candidate_id}")
async def get_candidate_details(candidate_id: str, admin: dict = Depends(require_admin)):
    """
    Retrieves complete candidate profile, full uploaded resume text, dialogue stream, and report.
    """
    try:
        doc = await find_candidate(candidate_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Candidate not found")
            
        report = doc.get("report") or {}
        final_score = doc.get("final_score")
        if final_score is None:
            final_score = report.get("overall_score", 70)
            
        return {
            "candidate_id": str(doc.get("_id", "")),
            "name": doc.get("name") or "Candidate",
            "email": doc.get("email") or "",
            "role": doc.get("role", "Software Engineer"),
            "domain": doc.get("domain", "General"),
            "resume_filename": doc.get("resume_filename", "resume.pdf"),
            "resume_text": doc.get("resume_text", "No resume text available."),
            "chat_history": doc.get("chat_history", []),
            "evaluations": doc.get("evaluations", []),
            "report": report,
            "final_score": int(final_score),
            "technical_score": float(doc.get("technical_score", report.get("technical_score", 0.0))),
            "cheat_warnings": doc.get("cheat_warnings", report.get("warning_count", 0)),
            "disqualified": doc.get("disqualified", report.get("disqualified", False)),
            "status": doc.get("status", "completed"),
            "created_at": doc.get("created_at", ""),
            "completed_at": doc.get("completed_at", "")
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Admin candidate detail error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# 1-HOUR JWT TOKEN & INVITATION ENDPOINTS
# ==========================================

@router.post("/verify-token")
async def verify_token_endpoint(request: TokenVerifyRequest):
    """
    Validates the 1-hour interview JWT token.
    Returns decoded assignee name, email, target role, domain, and expiration.
    """
    res = verify_interview_token(request.token)
    if not res.get("valid"):
        return {
            "valid": False,
            "expired": res.get("expired", False),
            "error": res.get("error", "Invalid or expired token")
        }
        
    payload = res.get("payload", {})
    candidate_id = payload.get("sub")
    
    try:
        candidate = await find_candidate(candidate_id)
    except Exception as e:
        print(f"Verify token DB lookup error: {e}")
        candidate = None

    is_completed = False
    if candidate and candidate.get("status") == "completed":
        is_completed = True
        
    return {
        "valid": True,
        "expired": False,
        "candidate_id": candidate_id,
        "name": payload.get("name"),
        "email": payload.get("email"),
        "role": payload.get("role"),
        "domain": payload.get("domain", "General"),
        "expires_at": payload.get("exp"),
        "is_completed": is_completed
    }

@router.post("/admin/create-invite")
async def create_candidate_invite(invite: CandidateInviteRequest, admin: dict = Depends(require_admin)):
    """
    Generates a 1-hour interview invite with embedded JWT token for a candidate in MongoDB.
    """
    try:
        candidates_col = get_candidates_collection()
        candidate_doc = {
            "name": invite.name,
            "email": invite.email,
            "role": invite.role,
            "domain": invite.domain or "General",
            "status": "invited",
            "resume_text": "",
            "resume_filename": "",
            "cheat_warnings": 0,
            "quiz_score": 0.0,
            "technical_score": 0.0,
            "final_score": 0,
            "evaluations": [],
            "chat_history": [],
            "created_at": datetime.utcnow().isoformat()
        }
        
        insert_res = await candidates_col.insert_one(candidate_doc)
        candidate_id = str(insert_res.inserted_id)
        
        token = create_interview_token(
            candidate_id=candidate_id,
            name=invite.name,
            email=invite.email,
            role=invite.role,
            domain=invite.domain or "General",
            expires_in_hours=INVITE_EXPIRY_HOURS
        )
        
        invite_url = f"{FRONTEND_URL}/?token={token}"
        
        await candidates_col.update_one(id_query(candidate_id), {"$set": {"invite_token": token, "invite_url": invite_url}})
            
        return {
            "candidate_id": candidate_id,
            "name": invite.name,
            "email": invite.email,
            "role": invite.role,
            "domain": invite.domain,
            "token": token,
            "invite_url": invite_url,
            "expires_in": f"{INVITE_EXPIRY_HOURS} hour(s)"
        }
    except Exception as e:
        print(f"Invite creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/admin/bulk-create-invites")
async def bulk_create_candidate_invites(bulk_req: BulkInviteRequest, admin: dict = Depends(require_admin)):
    """
    Bulk generates 1-hour interview JWT invitations for multiple candidates in MongoDB.
    """
    try:
        candidates_col = get_candidates_collection()
        results = []
        
        for invite in bulk_req.candidates:
            candidate_doc = {
                "name": invite.name,
                "email": invite.email,
                "role": invite.role,
                "domain": invite.domain or "General",
                "status": "invited",
                "resume_text": "",
                "resume_filename": "",
                "cheat_warnings": 0,
                "technical_score": 0.0,
                "quiz_score": 0.0,
                "final_score": 0,
                "evaluations": [],
                "chat_history": [],
                "created_at": datetime.utcnow().isoformat()
            }
            insert_res = await candidates_col.insert_one(candidate_doc)
            c_id = str(insert_res.inserted_id)
            
            token = create_interview_token(
                candidate_id=c_id,
                name=invite.name,
                email=invite.email,
                role=invite.role,
                domain=invite.domain or "General",
                expires_in_hours=INVITE_EXPIRY_HOURS
            )
            invite_url = f"{FRONTEND_URL}/?token={token}"
            
            await candidates_col.update_one(id_query(c_id), {"$set": {"invite_token": token, "invite_url": invite_url}})
                
            results.append({
                "candidate_id": c_id,
                "name": invite.name,
                "email": invite.email,
                "role": invite.role,
                "domain": invite.domain,
                "token": token,
                "invite_url": invite_url,
                "expires_in": f"{INVITE_EXPIRY_HOURS} hour(s)"
            })
            
        return {
            "invites": results,
            "total_created": len(results)
        }
    except Exception as e:
        print(f"Bulk invite creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

