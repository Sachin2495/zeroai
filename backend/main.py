import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from app.routes import interview, quiz, resume
from app.db.config import Database
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Mongo connects lazily on first query, so startup stays fast (Lambda cold starts)
    yield
    await Database.close_db()

class InterviewerAPIServer:
    def __init__(self):
        self.app = FastAPI(title="Zero Agentic Interviewer API", lifespan=lifespan)
        self.setup_middleware()
        self.setup_routes()

    def setup_middleware(self):
        # Comma-separated list of allowed origins, e.g. the frontend Function URL.
        # The frontend proxies /api/* server-side, so browsers normally never call this API directly.
        origins = [o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials="*" not in origins,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    def setup_routes(self):
        self.app.include_router(interview.router, prefix="/api")
        self.app.include_router(quiz.router)
        self.app.include_router(resume.router)

        @self.app.get("/")
        def read_root():
            return {"status": "online", "system": "Zero Interviewer Engine"}

        @self.app.get("/health")
        async def health():
            return {"status": "ok", "database": "up" if await Database.ping() else "down"}

server_manager = InterviewerAPIServer()
app = server_manager.app

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=True)
