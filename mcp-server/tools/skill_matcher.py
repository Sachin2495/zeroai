from sentence_transformers import SentenceTransformer, util
import torch

class SkillMatcher:
    """
    A class-based tool for semantically matching candidate skills/resumes 
    against job descriptions using Sentence Transformers.
    """
    def __init__(self):
        print("Loading Embedding model...")
        # 'all-MiniLM-L6-v2' is fast and efficient for this
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        print("Embedding model loaded.")

    def match(self, candidate_text: str, job_description: str) -> dict:
        """
        Computes the semantic similarity score between candidate and job.
        """
        # Compute embeddings
        embeddings1 = self.model.encode(candidate_text, convert_to_tensor=True)
        embeddings2 = self.model.encode(job_description, convert_to_tensor=True)

        # Compute cosine-similarity
        cosine_score = util.cos_sim(embeddings1, embeddings2)
        
        score = cosine_score.item() * 100 # Convert to percentage
        
        return {
            "match_percentage": round(score, 2),
            "feedback": self._generate_feedback(score)
        }

    def _generate_feedback(self, score: float) -> str:
        if score > 80:
            return "Excellent Match: Candidate profile strongly aligns with job requirements."
        elif score > 60:
            return "Good Match: Strong potential but some gaps may exist."
        elif score > 40:
            return "Moderate Match: Meets some criteria but lacks depth in key areas."
        else:
            return "Low Match: Candidate profile does not significantly overlap with requirements."
