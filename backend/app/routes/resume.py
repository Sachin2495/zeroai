from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response, Depends
from pydantic import BaseModel
import hashlib
import base64
import io
from datetime import datetime
from app.db.config import get_candidates_collection, find_candidate, id_query
from app.services.jwt_service import require_admin
import pypdf

router = APIRouter()

# Stored inline in MongoDB (16 MB document limit) and must fit through a Lambda
# Function URL request (6 MB payload), so keep this comfortably below both.
MAX_RESUME_BYTES = 4 * 1024 * 1024

class ResumeUploadResponse(BaseModel):
    candidate_id: str
    resume_hash: str
    message: str

def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """Extract readable text from PDF, DOCX or plain-text documents."""
    text = ""
    lower_name = filename.lower()
    if lower_name.endswith(".pdf"):
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            pages_text = []
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    pages_text.append(extracted)
            text = "\n".join(pages_text).strip()
        except Exception as e:
            print(f"[WARN] pypdf extraction failed: {e}")
    elif lower_name.endswith(".docx"):
        try:
            import docx
            document = docx.Document(io.BytesIO(file_bytes))
            text = "\n".join(p.text for p in document.paragraphs if p.text).strip()
        except Exception as e:
            print(f"[WARN] docx extraction failed: {e}")
    else:
        text = file_bytes.decode('utf-8', errors='ignore')

    return text.strip()

@router.post("/api/upload-resume", response_model=ResumeUploadResponse)
async def upload_resume(
    role: str = Form(...),
    domain: str = Form(...),
    name: str = Form(None),
    email: str = Form(None),
    candidate_id: str = Form(None),
    file: UploadFile = File(...)
):
    """
    Upload candidate resume and store the raw file plus extracted text in MongoDB.
    Attaches to the existing candidate record if candidate_id is provided.
    """
    try:
        resume_bytes = await file.read()
        if len(resume_bytes) > MAX_RESUME_BYTES:
            raise HTTPException(status_code=413, detail="Resume must be under 4 MB")
        filename = file.filename or "resume.pdf"
        if not filename.lower().endswith((".pdf", ".docx", ".txt")):
            raise HTTPException(status_code=400, detail="Please upload a PDF, DOCX or TXT file")
        content_type = file.content_type or ("application/pdf" if filename.lower().endswith(".pdf") else "application/octet-stream")

        resume_text = extract_text_from_file(resume_bytes, filename)
        resume_hash = hashlib.sha256(resume_bytes).hexdigest()
        resume_b64 = base64.b64encode(resume_bytes).decode('utf-8')

        candidates_collection = get_candidates_collection()
        resume_fields = {
            "resume_filename": filename,
            "resume_content_type": content_type,
            "resume_base64": resume_b64,
            "resume_text": resume_text,
            "resume_hash": resume_hash,
            "resume_size": len(resume_bytes),
        }

        if candidate_id:
            existing = await find_candidate(candidate_id)
            if existing:
                if existing.get("status") == "completed":
                    raise HTTPException(status_code=409, detail="This interview has already been completed")
                await candidates_collection.update_one(
                    id_query(candidate_id),
                    {"$set": {
                        "name": name or existing.get("name", "Candidate"),
                        "email": email or existing.get("email", ""),
                        "role": role or existing.get("role", "Software Engineer"),
                        "domain": domain or existing.get("domain", "General"),
                        **resume_fields,
                        "status": "in_progress",
                        "updated_at": datetime.utcnow().isoformat()
                    }}
                )
                return ResumeUploadResponse(
                    candidate_id=candidate_id,
                    resume_hash=resume_hash,
                    message="Resume attached successfully"
                )

        # No invite record: create a new candidate document
        candidate_doc = {
            "name": name or "Candidate",
            "email": email or "",
            "role": role,
            "domain": domain,
            **resume_fields,
            "status": "in_progress",
            "cheat_warnings": 0,
            "quiz_score": 0.0,
            "technical_score": 0.0,
            "evaluations": [],
            "chat_history": [],
            "created_at": datetime.utcnow().isoformat()
        }

        result = await candidates_collection.insert_one(candidate_doc)
        return ResumeUploadResponse(
            candidate_id=str(result.inserted_id),
            resume_hash=resume_hash,
            message="Resume uploaded successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Resume upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/api/candidates/{candidate_id}/resume-file")
async def get_candidate_resume_file(candidate_id: str, admin: dict = Depends(require_admin)):
    """
    Streams the raw resume PDF/document for embedded browser viewing in the Admin Portal.
    """
    try:
        doc = await find_candidate(candidate_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Candidate not found")

        filename = doc.get("resume_filename") or "resume.pdf"
        content_type = doc.get("resume_content_type", "application/pdf")
        b64_content = doc.get("resume_base64")

        file_bytes = None
        if b64_content:
            try:
                file_bytes = base64.b64decode(b64_content)
            except Exception:
                pass

        if not file_bytes:
            text = doc.get("resume_text") or "No resume content available."
            return Response(
                content=text.encode("utf-8"),
                media_type="text/plain; charset=utf-8",
                headers={"Content-Disposition": f"inline; filename=\"{filename}.txt\""}
            )

        return Response(
            content=file_bytes,
            media_type=content_type,
            headers={
                "Content-Disposition": f"inline; filename=\"{filename}\"",
                "Cache-Control": "private, max-age=3600"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Fetching resume file: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve resume file")
