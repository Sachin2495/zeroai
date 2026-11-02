from typing import TypedDict, List, Dict, Any, Union
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langgraph.graph import StateGraph, END
import json
import re
from app.services.llm import get_llm

# Define Interview State
class InterviewState(TypedDict):
    messages: List[BaseMessage]
    candidate_info: Dict[str, Any]
    current_question: str
    technical_score: float
    cheat_warnings: int
    emotion_log: List[Dict[str, Any]]
    last_emotion: Dict[str, Any]
    evaluations: List[Dict[str, Any]]
    behavioral_directive: str
    proctor_alert: str
    next_agent: str
    response_text: str

# 1. Proctor Node
def proctor_node(state: InterviewState) -> Dict[str, Any]:
    last_emotion = state.get("last_emotion", {})
    cheat_warnings = state.get("cheat_warnings", 0)
    
    # Telemetry parameters passed from frontend MediaPipe
    gaze_direction = last_emotion.get("gaze_direction", "center")
    face_present = last_emotion.get("face_present", True)
    tab_switch_alert = last_emotion.get("tab_switch_alert", False)
    
    warning_triggered = False
    warning_reason = ""
    
    if tab_switch_alert:
        cheat_warnings += 1
        warning_triggered = True
        warning_reason = "Tab switching / browser window lost focus"
    elif not face_present:
        cheat_warnings += 1
        warning_triggered = True
        warning_reason = "No candidate face detected on camera"

    return {
        "cheat_warnings": cheat_warnings,
        "proctor_alert": warning_reason if warning_triggered else "",
        "next_agent": "behavioral"
    }

# 2. Behavioral Adaptor Node
def behavioral_node(state: InterviewState) -> Dict[str, Any]:
    last_emotion = state.get("last_emotion", {})
    emotion_label = last_emotion.get("label", "neutral").lower()
    
    behavioral_context = ""
    if emotion_label == "nervous":
        behavioral_context = (
            "The candidate appears nervous. Start your response with a brief comforting and reassuring phrase "
            "(e.g., 'Take your time', 'You are doing great') before continuing."
        )
    elif emotion_label == "happy":
        behavioral_context = "The candidate is smiling and positive. Maintain a warm, encouraging tone."
    elif emotion_label == "focused":
        behavioral_context = "The candidate is focused and attentive. You can dive deeper into technical details."
        
    return {
        "behavioral_directive": behavioral_context,
        "next_agent": "evaluator"
    }

# Spoken dialogue text cleaner to strip markdown formatting
def clean_spoken_text(text: str) -> str:
    if not text:
        return ""
    # Strip markdown code blocks
    text = re.sub(r'```[\s\S]*?```', '', text)
    # Strip inline code formatting
    text = re.sub(r'`+([^`]+)`+', r'\1', text)
    # Strip markdown headers (e.g. ###, ##, #)
    text = re.sub(r'#+\s*', '', text)
    # Strip markdown bold and italic markers (*, **, _, __)
    text = re.sub(r'[*_]{1,3}([^*_]+)[*_]{1,3}', r'\1', text)
    text = re.sub(r'[*_]+', '', text)
    # Strip markdown lists / bullet points
    text = re.sub(r'^\s*[-*•\d\.]+\s+', '', text, flags=re.MULTILINE)
    # Strip blockquotes and html tags
    text = re.sub(r'^\s*>\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'<[^>]+>', '', text)
    # Clean unwanted punctuation / special symbols that TTS reads aloud
    text = re.sub(r'[`~|\\^{}\[\]]', '', text)
    # Collapse multiple spaces and newlines
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# 3. Real-Time Evaluation Node
async def evaluator_node(state: InterviewState) -> Dict[str, Any]:
    messages = state.get("messages", [])
    current_question = state.get("current_question", "")
    evaluations = list(state.get("evaluations", []))
    current_avg = state.get("technical_score", 0.0)
    
    # Locate the last user response
    user_answer = ""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            user_answer = msg.content
            break
            
    if not user_answer or not current_question:
        return {
            "evaluations": evaluations,
            "technical_score": current_avg,
            "next_agent": "interviewer"
        }
        
    eval_prompt = (
        f"You are a technical evaluation assistant.\n"
        f"Question Asked: {current_question}\n"
        f"Candidate Answer: {user_answer}\n\n"
        f"Assess the answer's technical accuracy, depth, and completeness on a scale of 0 to 100.\n"
        f"Format your response EXACTLY as a JSON object (no markdown, no quotes outside JSON):\n"
        f'{{"score": 85, "feedback": "Brief feedback here."}}'
    )
    
    try:
        llm = get_llm(temperature=0.2)
        resp = await llm.ainvoke([
            SystemMessage(content="You are an automated evaluation node. Respond only in valid JSON."),
            HumanMessage(content=eval_prompt)
        ])
        content = resp.content if hasattr(resp, "content") else str(resp)
        
        # Robust JSON extraction
        json_match = re.search(r'\{[^{}]*\}', content)
        if json_match:
            eval_data = json.loads(json_match.group(0))
        else:
            clean_content = content.replace("```json", "").replace("```", "").strip()
            eval_data = json.loads(clean_content)
            
        score = float(eval_data.get("score", 50.0))
        score = max(0.0, min(100.0, score))
        feedback = eval_data.get("feedback", "Candidate answered technical query.")
        
        evaluations.append({
            "question": clean_spoken_text(current_question),
            "answer": user_answer,
            "score": score,
            "feedback": feedback
        })
        
        # Calculate running average
        all_scores = [ev["score"] for ev in evaluations]
        avg_score = sum(all_scores) / len(all_scores) if all_scores else 0.0
        
        return {
            "evaluations": evaluations,
            "technical_score": round(avg_score, 1),
            "next_agent": "interviewer"
        }
    except Exception as e:
        print(f"[WARN] Real-time evaluation agent error: {e}")
        evaluations.append({
            "question": clean_spoken_text(current_question),
            "answer": user_answer,
            "score": 40.0,
            "feedback": "Answer recorded successfully."
        })
        all_scores = [ev["score"] for ev in evaluations]
        avg_score = sum(all_scores) / len(all_scores) if all_scores else 0.0
        return {
            "evaluations": evaluations,
            "technical_score": round(avg_score, 1),
            "next_agent": "interviewer"
        }

# 4. Technical Interviewer Node
async def interviewer_node(state: InterviewState) -> Dict[str, Any]:
    messages = state.get("messages", [])
    candidate_info = state.get("candidate_info", {})
    role = candidate_info.get("role", "Software Engineer")
    resume_text = candidate_info.get("resume_text", "")
    cheat_warnings = state.get("cheat_warnings", 0)
    behavioral_directive = state.get("behavioral_directive", "")
    proctor_alert = state.get("proctor_alert", "")
    
    system_msg = (
        f"You are Zero, an expert technical interviewer conducting a live conversational voice interview for a {role} position.\n"
        f"Candidate Resume Summary:\n{resume_text[:1200]}\n\n"
        "STRICT VOICE & DIALOGUE CONSTRAINTS (MANDATORY):\n"
        "1. PURE SPOKEN ENGLISH: Output dialogue designed specifically to be read out loud by a voice synthesizer. Speak naturally as a human technical interviewer.\n"
        "2. ZERO MARKDOWN: Absolutely NO markdown symbols. NEVER use hashes (# or ###), asterisks (* or **), underscores, backticks, bullet points, numbered lists, or code fences.\n"
        "3. VERBAL SCENARIOS: If asking a technical problem or scenario, describe it conversationally in plain words. NEVER paste raw code or syntax.\n"
        "4. CONCISE LENGTH: Strictly maximum 2 to 3 sentences. Ask exactly one focused technical question or follow-up at a time.\n"
        "5. FAST FLOW: Acknowledge the candidate's last point briefly and naturally, then ask your question.\n"
    )
    if behavioral_directive:
        system_msg += f"\n[BEHAVIORAL DIRECTIVE]: {behavioral_directive}"
    if proctor_alert:
        system_msg += f"\n[PROCTOR NOTICE]: {proctor_alert}. Gently remind candidate to stay focused on this screen."
        
    prompt_messages = [SystemMessage(content=system_msg)]
    
    # Filter conversation history for Human and AI messages
    for msg in messages:
        if isinstance(msg, (HumanMessage, AIMessage)):
            prompt_messages.append(msg)
            
    # Guarantee at least one HumanMessage is present
    if not any(isinstance(m, HumanMessage) for m in prompt_messages):
        prompt_messages.append(HumanMessage(content="Hello, I am ready for the technical interview."))
            
    try:
        llm = get_llm()
        response = await llm.ainvoke(prompt_messages)
        ai_text = response.content if hasattr(response, "content") else str(response)
        
        # Clean markdown symbols for conversational voice
        clean_text = clean_spoken_text(ai_text)
        if not clean_text or len(clean_text) < 10:
            clean_text = f"That is a good explanation. In your experience as a {role}, how do you ensure reliability and fault tolerance under high traffic?"
        
        return {
            "messages": messages + [AIMessage(content=clean_text)],
            "current_question": clean_text,
            "response_text": clean_text
        }
    except Exception as e:
        print(f"[WARN] Interviewer agent error: {e}")
        fallback_text = f"Could you explain your favorite technical project involving {role} architecture?"
        return {
            "messages": messages + [AIMessage(content=fallback_text)],
            "current_question": fallback_text,
            "response_text": fallback_text
        }

# Compile StateGraph
builder = StateGraph(InterviewState)
builder.add_node("proctor", proctor_node)
builder.add_node("behavioral", behavioral_node)
builder.add_node("evaluator", evaluator_node)
builder.add_node("interviewer", interviewer_node)

builder.set_entry_point("proctor")
builder.add_edge("proctor", "behavioral")
builder.add_edge("behavioral", "evaluator")
builder.add_edge("evaluator", "interviewer")
builder.add_edge("interviewer", END)

interview_graph = builder.compile()

class MultiAgentInterviewer:
    def __init__(self):
        self.graph = interview_graph

    async def interact(self, session_id: str, transcript: str, last_emotion: Dict[str, Any], candidate_info: Dict[str, Any], chat_history: List[Any] = None) -> Dict[str, Any]:
        """
        Executes the LangGraph multi-agent pipeline with user response + telemetry input.
        """
        messages = []
        if chat_history:
            for msg in chat_history:
                if msg.get("role") == "user":
                    messages.append(HumanMessage(content=msg.get("content", "")))
                elif msg.get("role") in ["assistant", "ai"]:
                    messages.append(AIMessage(content=msg.get("content", "")))
                    
        messages.append(HumanMessage(content=transcript))
        
        initial_state = {
            "messages": messages,
            "candidate_info": candidate_info,
            "current_question": candidate_info.get("current_question", ""),
            "technical_score": candidate_info.get("technical_score", 0.0),
            "cheat_warnings": candidate_info.get("cheat_warnings", 0),
            "emotion_log": candidate_info.get("emotion_log", []),
            "last_emotion": last_emotion,
            "evaluations": candidate_info.get("evaluations", []),
            "behavioral_directive": "",
            "proctor_alert": "",
            "next_agent": "proctor",
            "response_text": ""
        }
        
        final_state = await self.graph.ainvoke(initial_state)
        return final_state
