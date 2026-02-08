from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
import hashlib
from datetime import datetime
from app.db.config import get_candidates_collection

router = APIRouter()

class ResumeUploadResponse(BaseModel):
    candidate_id: str
    resume_hash: str
    message: str

@router.post("/api/upload-resume", response_model=ResumeUploadResponse)
async def upload_resume(
    role: str = Form(...),
    domain: str = Form(...),
    name: str = Form(None),
    email: str = Form(None),
    file: UploadFile = File(...)
):
    """
    Upload candidate resume, hash it, and store in MongoDB.
    """
    try:
        # Read file content
        resume_bytes = await file.read()
        resume_text = resume_bytes.decode('utf-8', errors='ignore')
        
        # Generate SHA256 hash
        resume_hash = hashlib.sha256(resume_bytes).hexdigest()
        
        # Create candidate document
        candidate_doc = {
            "name": name,
            "email": email,
            "role": role,
            "domain": domain,
            "resume_text": resume_text,
            "resume_hash": resume_hash,
            "created_at": datetime.utcnow()
        }
        
        # Insert into MongoDB
        candidates_collection = get_candidates_collection()
        result = await candidates_collection.insert_one(candidate_doc)
        
        return ResumeUploadResponse(
            candidate_id=str(result.inserted_id),
            resume_hash=resume_hash,
            message="Resume uploaded successfully"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
