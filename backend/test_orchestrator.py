import asyncio
import os
from dotenv import load_dotenv

# Load env manually since we are running as script
load_dotenv()

# Mock setup to run Orchestrator
try:
    from app.services.orchestrator import InterviewOrchestrator
except ImportError:
    # Fix path if running from backend root
    import sys
    sys.path.append(os.getcwd())
    from app.services.orchestrator import InterviewOrchestrator

async def test():
    print("Initializing Orchestrator...")
    try:
        orch = InterviewOrchestrator()
        print("Orchestrator initialized.")
    except Exception as e:
        print(f"FAILED to initialize: {e}")
        return

    print("Testing generate_response...")
    try:
        response = await orch.generate_response("Hello, I am ready for the interview.", "neutral")
        print(f"RESPONSE: {response}")
    except Exception as e:
        print(f"FAILED to generate response: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
