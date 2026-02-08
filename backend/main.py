from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from app.routes import interview, quiz, resume
from app.db.config import Database

class InterviewerAPIServer:
    def __init__(self):
        self.app = FastAPI(title="Zero Agentic Interviewer API")
        self.setup_middleware()
        self.setup_events()
        self.setup_routes()

    def setup_middleware(self):
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    def setup_events(self):
        @self.app.on_event("startup")
        async def startup_db():
            await Database.connect_db()
        
        @self.app.on_event("shutdown")
        async def shutdown_db():
            await Database.close_db()

    def setup_routes(self):
        self.app.include_router(interview.router, prefix="/api")
        self.app.include_router(quiz.router)  # Quiz router
        self.app.include_router(resume.router)  # Resume router

        @self.app.get("/")
        def read_root():
            return {"status": "online", "system": "Zero Interviewer Engine", "architecture": "Class-Based", "database": "MongoDB"}

server_manager = InterviewerAPIServer()
app = server_manager.app

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
