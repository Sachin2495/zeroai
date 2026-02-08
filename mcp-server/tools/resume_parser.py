from transformers import pipeline

class ResumeParser:
    """
    A class-based tool for parsing resumes using Hugging Face NER.
    """
    def __init__(self):
        # Initialize the NER pipeline
        # using a lightweight NER model for demonstration speed
        # For production, we would use a fine-tuned model on resumes
        print("Loading NER model...")
        self.ner_pipeline = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
        print("NER model loaded.")

    def parse(self, text: str) -> dict:
        """
        Extracts entities from the resume text.
        """
        entities = self.ner_pipeline(text)
        
        # Structure the output
        structured_data = {
            "skills": [],
            "companies": [],
            "locations": [],
            "raw_entities": []
        }

        for entity in entities:
            tag = entity["entity_group"]
            word = entity["word"]
            
            structured_data["raw_entities"].append({"entity": flow_entity(entity)})

            if tag == "ORG":
                structured_data["companies"].append(word)
            elif tag == "LOC":
                structured_data["locations"].append(word)
            # Note: BERT-NER standard is mostly PER, ORG, LOC, MISC. 
            # ideally we need a Skill-Extraction model. 
            # For now, we will assume MISC might contain technologies or use a keyword lookup 
            # combined with this.
        
        # Simple Keyword Fallback for tech skills (since generic NER captures ORG/LOC/PER)
        structured_data["skills"] = self._extract_keyword_skills(text)
        
        return structured_data

    def _extract_keyword_skills(self, text: str) -> list[str]:
        # A basic list of tech keywords to look for
        common_skills = [
            "Python", "JavaScript", "React", "Next.js", "FastAPI", "PostgreSQL",
            "Docker", "Kubernetes", "AWS", "TypeScript", "Java", "C++", "Machine Learning"
        ]
        found_skills = [skill for skill in common_skills if skill.lower() in text.lower()]
        return list(set(found_skills))

def flow_entity(entity):
    # Helper to clean up numpy types for JSON serialization if needed
    return {
        "word": entity["word"],
        "score": float(entity["score"]),
        "entity": entity["entity_group"],
        "start": entity["start"],
        "end": entity["end"]
    }
