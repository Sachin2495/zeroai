from huggingface_hub import InferenceClient
import os
import asyncio

class InterviewOrchestrator:
    """
    Manages the interview flow using Hugging Face Inference API.
    """
    def __init__(self):
        self.history = []
        # Fallback to a free model if no key is present instantly, 
        # but User promised keys. We'll default to 'meta-llama/Meta-Llama-3-70B-Instruct'
        # Note: This requires HF_TOKEN in env or login.
        self.model_id = "meta-llama/Meta-Llama-3-70B-Instruct" 
        self.client = InferenceClient(token=os.getenv("HF_TOKEN"))
        
        self.system_prompt = (
            "You are Zero, an advanced AI technical interviewer. "
            "Your goal is to assess the candidate's skills accurately while maintaining a professional and empathetic persona. "
            "1. adapt your tone based on the candidate's reported emotion. If they are 'nervous', be reassuring. "
            "2. Do NOT ask generic questions. Pivot based on their last answer. "
            "3. Keep responses concise (under 3 sentences) to maintain conversation flow."
        )

    async def generate_response(self, transcript: str, emotion_label: str) -> str:
        """
        Generates a response using Hugging Face Inference API.
        """
        # Construct dynamic context
        # In a real app, we'd append this to a sliding window history
        user_message = f"[Emotion: {emotion_label}] {transcript}"
        
        messages = [
            {"role": "system", "content": self.system_prompt},
        ]
        
        # Add history (simplified for demo)
        for h in self.history[-4:]: # Keep last 4 turns
            messages.append(h)
            
        messages.append({"role": "user", "content": user_message})

        # Check for placeholder/missing token to avoid API errors
        token = os.getenv("HF_TOKEN")
        if not token or token == "no":
            print("Using Fallback Logic (Invalid/Missing Token)")
            return self._fallback_logic(transcript, emotion_label)

        try:
            # Call HF Inference
            # Streaming is better for latency, but blocking is easier for first pass
            response = self.client.chat_completion(
                model=self.model_id,
                messages=messages,
                max_tokens=150,
                temperature=0.7
            )
            
            ai_text = response.choices[0].message.content
            
            # Update History
            self.history.append({"role": "user", "content": transcript})
            self.history.append({"role": "assistant", "content": ai_text})
            
            return ai_text

        except Exception as e:
            print(f"HF Inference Error: {e}")
            # Fallback if API fails (e.g. no key yet)
            return self._fallback_logic(transcript, emotion_label)

    def _fallback_logic(self, transcript, emotion_label):
        """Temporary local fallback if HF API Key is missing."""
        if "nervous" in emotion_label.lower():
            return "I notice you're a bit nervous. Take a deep breath. Could you tell me about a project you enjoyed?"
        return "That's interesting. Could you go into more detail about the technical challenges?"

    async def generate_report(self, session_id: str):
        """
        Generates a comprehensive interview report using the LLM.
        """
        if not self.history:
            return {
                "score": 0,
                "summary": "No interview data found.",
                "feedback": "The candidate has not started the interview yet."
            }
            
        # Construct prompt for the reporter persona
        transcript_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in self.history])
        
        reporter_prompt = (
            "You are an expert Technical Recruiter. Review the following interview transcript and generate a JSON report. "
            "The report must include: "
            "1. 'score': An integer 0-100 based on technical depth and communication. "
            "2. 'summary': A 2-sentence summary of the candidate's performance. "
            "3. 'strengths': A list of top 3 strengths. "
            "4. 'weaknesses': A list of top 3 areas for improvement. "
            "5. 'recommendation': 'Hire', 'No Hire', or 'Strong Hire'. "
            "Output ONLY valid JSON."
        )
        
        messages = [
            {"role": "system", "content": reporter_prompt},
            {"role": "user", "content": f"Transcript:\n{transcript_text}"}
        ]
        
        try:
            response = self.client.chat_completion(
                model=self.model_id,
                messages=messages,
                max_tokens=500,
                temperature=0.2
            )
            report_json = response.choices[0].message.content
            # Cleanup Markdown if present
            report_json = report_json.replace("```json", "").replace("```", "").strip()
            
            return report_json
            
        except Exception as e:
            print(f"Report Gen Error: {e}")
            return {
                "score": 75,
                "summary": "Technical interview completed. Automated report generation failed.",
                "recommendation": "Review Manual"
            }

