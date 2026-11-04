# Zero Agentic Interviewer

An AI interview platform that takes a candidate from an invite link to a scored report for the recruiter. Candidates speak with an AI interviewer in the browser while a team of agents proctors, evaluates and asks the next question.

**[Live app](https://fgwxgvjncl2pnq3e2fuzbwd5iy0mxqqb.lambda-url.ap-south-1.on.aws)**

Interviews start from an invite link, which recruiters create in the admin portal.

## How it works

1. A recruiter creates single or bulk invites from the admin portal.
2. The candidate opens their invite link and uploads a resume.
3. The candidate completes a quiz round.
4. The candidate speaks with the AI interviewer over camera and microphone.
5. The recruiter reviews the candidate and their report in the admin portal.

## The agents

Each interview turn runs through a [LangGraph](https://github.com/langchain-ai/langgraph) pipeline:

```text
Proctor → Behavioral → Evaluator → Interviewer
```

| Agent | Role |
|---|---|
| Proctor | Reviews integrity signals from the interview |
| Behavioral | Reviews how the candidate is coming across |
| Evaluator | Assesses the candidate's answer |
| Interviewer | Decides what to say next |

The browser tracks the candidate's face with MediaPipe and handles voice with the Web Speech API.

## Tech stack

| Part | Technology |
|---|---|
| Front end | Next.js, React, TypeScript, Tailwind CSS |
| Back end | FastAPI, Python |
| Agents | LangGraph, LangChain |
| Models | Groq when deployed, Ollama for local development |
| Database | MongoDB Atlas |
| Auth | JWT invite and admin tokens |
| Hosting | AWS Lambda container images, Amazon ECR, Lambda Function URLs |

## Architecture

```text
Browser → Next.js on Lambda → FastAPI on Lambda → MongoDB Atlas
                                      ↓
                                  Groq models
```

The browser only talks to the front end, which forwards `/api/*` to the back end from the server. That means no CORS setup, and the back end URL can change without rebuilding the front end.

## Run it locally

You'll need Python 3.11, Node.js, a MongoDB database, and either a Groq API key or a local Ollama install.

Back end:

```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
python main.py
```

Fill in `.env` before starting. The API runs on port 8000.

Front end:

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

Open http://localhost:3000.

## Deploy

See [deploy/README.md](deploy/README.md) for the AWS Lambda steps.
