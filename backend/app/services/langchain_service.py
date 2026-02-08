from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_ollama import ChatOllama
from langchain_groq import ChatGroq
import os
from dotenv import load_dotenv

load_dotenv()

class InterviewAgent:
    def __init__(self):
        self.provider = os.getenv("LLM_PROVIDER", "ollama").lower()
        print(f"Initializing InterviewAgent with provider: {self.provider}")
        
        if self.provider == "groq":
            api_key = os.getenv("GROQ_API_KEY")
            if not api_key:
                raise ValueError("GROQ_API_KEY not found in environment variables")
            self.llm = ChatGroq(
                temperature=0.7,
                model_name="llama-3.3-70b-versatile",
                api_key=api_key
            )
        else:
            # Default to Ollama
            base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            self.llm = ChatOllama(
                model="llama3:latest",
                temperature=0.7,
                base_url=base_url
            )
            
        self.history = []
        self.system_prompt = (
            "You are Zero, an advanced AI technical interviewer. "
            "Your goal is to assess the candidate's skills accurately while maintaining a professional and empathetic persona. "
            "1. Adapt your tone based on the candidate's reported emotion. If they are 'nervous', be reassuring. "
            "2. Do NOT ask generic questions. Pivot based on their last answer. "
            "3. Keep responses concise (under 3 sentences) to maintain conversation flow."
        )

    async def generate_response(self, transcript: str, emotion_label: str) -> str:
        """
        Generates a response using the configured LLM provider.
        """
        try:
            # Add empathetic context for nervous candidates
            emotion_context = ""
            if emotion_label.lower() == "nervous":
                emotion_context = (
                    "The candidate appears nervous. Start your response with a brief reassuring statement "
                    "like 'No worries, take your time' or 'That's perfectly fine' or 'You're doing great' "
                    "before proceeding with your question or feedback. Keep a warm, supportive tone."
                )
            
            # Construct dynamic prompt
            system_msg = self.system_prompt
            if emotion_context:
                system_msg += f"\n\nIMPORTANT: {emotion_context}"
            
            prompt = ChatPromptTemplate.from_messages([
                ("system", system_msg),
                *[("user", msg["content"]) if msg["role"] == "user" else ("assistant", msg["content"]) for msg in self.history[-4:]],
                ("user", f"[Emotion: {emotion_label}] {transcript}")
            ])
            
            chain = prompt | self.llm | StrOutputParser()
            
            response = await chain.ainvoke({})
            
            # Update History
            self.history.append({"role": "user", "content": transcript})
            self.history.append({"role": "assistant", "content": response})
            
            return response
            
        except Exception as e:
            print(f"LLM Error ({self.provider}): {e}")
            return "I'm having a bit of trouble connecting to my thought process. Could you repeat that?"

    async def generate_quiz(self, resume_text: str, domain: str):
        """
        Generate 10 domain-specific quiz questions from resume.
        Returns list of {question, options, correct_index}
        """
        quiz_prompt = (
            f"You are a technical recruiter creating a quiz for a {domain} position. "
            f"Based on the candidate's resume below, generate EXACTLY 10 multiple-choice questions. "
            f"Questions should test their claimed skills, experience, and domain knowledge. "
            f"Format: Return ONLY valid JSON array with this structure:\n"
            f"[\n"
            f'  {{"question": "...", "options": ["A", "B", "C", "D"], "correct_index": 0}},\n'
            f"  ...\n"
            f"]\n\n"
            f"Resume:\n{resume_text[:2000]}\n\n"
            f"Generate 10 {domain}-specific questions now:"
        )
        
        try:
            # Use simple messages without template variables
            from langchain_core.messages import HumanMessage, SystemMessage
            
            messages = [
                SystemMessage(content="You are a technical quiz generator. Output only valid JSON."),
                HumanMessage(content=quiz_prompt)
            ]
            
            quiz_json = await self.llm.ainvoke(messages)
            
            # Extract content from response
            if hasattr(quiz_json, 'content'):
                quiz_json = quiz_json.content
            
            # Clean and parse JSON
            quiz_json = str(quiz_json).replace("```json", "").replace("```", "").strip()
            
            import json
            questions = json.loads(quiz_json)
            
            # Ensure exactly 10 questions
            if len(questions) > 10:
                questions = questions[:10]
            elif len(questions) < 10:
                raise ValueError(f"Only {len(questions)} questions generated")
            
            return questions
            
        except Exception as e:
            print(f"Quiz Generation Error: {e}")
            raise Exception(f"Failed to generate quiz: {str(e)}")

    async def generate_report(self, session_id: str) -> str:
        """
        Generates a comprehensive interview report.
        """
        if not self.history or len(self.history) < 2:
            # Generate basic report if minimal conversation
            return self._generate_basic_report()
        
        conversation_summary = "\n".join([
            f"{'Candidate' if msg['role'] == 'user' else 'AI'}: {msg['content'][:200]}"
            for msg in self.history[-10:]  # Last 10 messages
        ])
        
        report_prompt = f"""
Based on this interview conversation, generate a comprehensive candidate assessment report.

Conversation:
{conversation_summary}

Generate a detailed JSON report with:
- overall_score (0-100)
- strengths (list of 3-5 strengths)
- weaknesses (list of 3-5 areas for improvement)
- summary (2-3 sentence overall assessment)
- recommendation (hire/consider/reject with explanation)

Return ONLY valid JSON.
"""
        
        try:
            from langchain_core.messages import HumanMessage, SystemMessage
            
            messages = [
                SystemMessage(content="You are an expert technical interviewer creating assessment reports."),
                HumanMessage(content=report_prompt)
            ]
            
            response = await self.llm.ainvoke(messages)
            
            if hasattr(response, 'content'):
                response = response.content
            
            return str(response)
            
        except Exception as e:
            print(f"Report Generation Error: {e}")
            return self._generate_basic_report()
    
    def _generate_basic_report(self) -> str:
        """Generate a basic report when conversation history is minimal."""
        import json
        return json.dumps({
            "overall_score": 70,
            "strengths": [
                "Engaged with the interview process",
                "Willing to participate in technical assessment",
                "Showed interest in the role"
            ],
            "weaknesses": [
                "Limited conversation data for full assessment",
                "Needs more in-depth technical discussion",
                "Interview duration was brief"
            ],
            "summary": "Candidate completed the initial interview process. More extensive technical discussion would be beneficial for a complete evaluation.",
            "recommendation": "Consider for next round - Schedule a longer technical interview to better assess capabilities."
        })
