import asyncio
import os
import sys
from dotenv import load_dotenv

load_dotenv()

# Add backend root to sys.path
sys.path.append(os.getcwd())

from app.db.config import Database
from app.services.langgraph_agent import MultiAgentInterviewer

async def run_tests():
    print("[INFO] Initializing Database configuration...")
    await Database.connect_db()
    
    print("\n[INFO] Initializing Multi-Agent LangGraph Interviewer...")
    interviewer = MultiAgentInterviewer()
    print("[SUCCESS] Multi-Agent Interviewer Compiled successfully.")

    # Mock candidate session data
    candidate_info = {
        "role": "Frontend Engineer",
        "resume_text": "Experienced React developer with React Native and TypeScript skills.",
        "cheat_warnings": 0,
        "technical_score": 75.0,
        "evaluations": [],
        "current_question": "Explain the virtual DOM in React."
    }

    # Test Case 1: Standard conversation flow with focused candidate
    print("\n[TEST] Test Case 1: Standard focused candidate response")
    last_emotion = {
        "label": "focused",
        "score": 0.85,
        "gaze_direction": "center",
        "face_present": True,
        "tab_switch_alert": False
    }
    
    result = await interviewer.interact(
        session_id="test_candidate_123",
        transcript="The virtual DOM is a programming concept where a virtual representation of the UI is kept in memory and synced with the real DOM via reconciliation.",
        last_emotion=last_emotion,
        candidate_info=candidate_info,
        chat_history=[]
    )

    print(f"   Interviewer Output Question: '{result.get('response_text')}'")
    print(f"   Cheat Warnings Count: {result.get('cheat_warnings')}")
    print(f"   Updated Technical Score: {result.get('technical_score')}%")
    print(f"   Evaluations Count: {len(result.get('evaluations'))}")
    assert result.get("cheat_warnings") == 0, "Warning count should be 0"

    # Test Case 2: Nervous candidate response (Checks behavioral adaptation)
    print("\n[TEST] Test Case 2: Nervous candidate response behavioral check")
    last_emotion_nervous = {
        "label": "nervous",
        "score": 0.9,
        "gaze_direction": "center",
        "face_present": True,
        "tab_switch_alert": False
    }
    
    result_nervous = await interviewer.interact(
        session_id="test_candidate_123",
        transcript="I... I am not fully sure but I think virtual DOM makes it faster by updating only what changed.",
        last_emotion=last_emotion_nervous,
        candidate_info=candidate_info,
        chat_history=[
            {"role": "user", "content": "The virtual DOM is a programming concept where a virtual representation of the UI is kept in memory and synced with the real DOM via reconciliation."},
            {"role": "assistant", "content": result.get("response_text")}
        ]
    )
    print(f"   Interviewer Output Question: '{result_nervous.get('response_text')}'")
    
    # Test Case 3: Proctor warning generation (Tab switch detected)
    print("\n[TEST] Test Case 3: Proctor warning test (tab switch)")
    last_emotion_cheating = {
        "label": "neutral",
        "score": 0.5,
        "gaze_direction": "center",
        "face_present": True,
        "tab_switch_alert": True
    }
    
    result_cheating = await interviewer.interact(
        session_id="test_candidate_123",
        transcript="Yes, virtual DOM uses a diffing algorithm.",
        last_emotion=last_emotion_cheating,
        candidate_info=candidate_info,
        chat_history=[]
    )
    print(f"   Cheat Warnings Count after tab switch: {result_cheating.get('cheat_warnings')}")
    assert result_cheating.get("cheat_warnings") == 1, "Warning count should be incremented to 1"

    print("\n[SUCCESS] All backend test cases executed successfully!")

if __name__ == "__main__":
    asyncio.run(run_tests())
