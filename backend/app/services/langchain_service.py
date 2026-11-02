import json
import re
from typing import Any, Dict, List
from langchain_core.messages import HumanMessage, SystemMessage
from app.services.llm import get_llm

QUIZ_LENGTH = 10
MIN_QUIZ_LENGTH = 5


def _extract_json_array(content: str) -> List[Any]:
    """Pulls the first JSON array out of an LLM reply, tolerating code fences and chatter."""
    content = re.sub(r"<think>[\s\S]*?</think>", "", content)
    content = content.replace("```json", "").replace("```", "").strip()
    start, end = content.find("["), content.rfind("]")
    if start == -1 or end <= start:
        raise ValueError("No JSON array found in quiz response")
    return json.loads(content[start:end + 1])


def _validate_questions(raw: List[Any]) -> List[Dict[str, Any]]:
    questions = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        question = str(item.get("question", "")).strip()
        options = [str(o).strip() for o in item.get("options", []) if str(o).strip()]
        try:
            correct = int(item.get("correct_index", -1))
        except (TypeError, ValueError):
            continue
        if question and len(options) == 4 and 0 <= correct < 4:
            questions.append({"question": question, "options": options, "correct_index": correct})
    return questions[:QUIZ_LENGTH]


class InterviewAgent:
    """Generates the round-1 multiple-choice screening quiz."""

    def __init__(self):
        self.llm = get_llm(temperature=0.5)

    async def generate_quiz(self, resume_text: str, domain: str) -> List[Dict[str, Any]]:
        """
        Generate domain-specific quiz questions from the resume.
        Returns list of {question, options, correct_index}.
        """
        quiz_prompt = (
            f"You are a technical recruiter creating a quiz for a {domain} position. "
            f"Based on the candidate's resume below, generate EXACTLY {QUIZ_LENGTH} multiple-choice questions. "
            f"Questions should test their claimed skills, experience, and domain knowledge. "
            f"Each question has exactly 4 options and one correct answer.\n"
            f"Return ONLY a valid JSON array with this structure, no other text:\n"
            f'[{{"question": "...", "options": ["A", "B", "C", "D"], "correct_index": 0}}]\n\n'
            f"Resume:\n{resume_text[:2000]}\n"
        )
        messages = [
            SystemMessage(content="You are a technical quiz generator. Output only valid JSON."),
            HumanMessage(content=quiz_prompt),
        ]

        last_error: Exception = ValueError("Quiz generation failed")
        for attempt in range(2):
            try:
                resp = await self.llm.ainvoke(messages)
                content = resp.content if hasattr(resp, "content") else str(resp)
                questions = _validate_questions(_extract_json_array(str(content)))
                if len(questions) < MIN_QUIZ_LENGTH:
                    raise ValueError(f"Only {len(questions)} valid questions generated")
                return questions
            except Exception as e:
                print(f"[WARN] Quiz generation attempt {attempt + 1} failed: {e}")
                last_error = e
        raise RuntimeError(f"Failed to generate quiz: {last_error}")
