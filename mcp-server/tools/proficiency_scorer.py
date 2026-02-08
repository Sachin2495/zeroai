from transformers import pipeline

class ProficiencyScorer:
    """
    A class-based tool for assessing language or technical proficiency 
    using Zero-Shot Classification.
    """
    def __init__(self):
        print("Loading Zero-Shot Classification model...")
        self.classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")
        print("Classification model loaded.")

    def assess(self, text: str, domain: str = "general") -> dict:
        """
        Classifies the text into proficiency levels.
        """
        if domain == "language":
            labels = ["A1 - Beginner", "A2 - Elementary", "B1 - Intermediate", "B2 - Upper Intermediate", "C1 - Advanced", "C2 - Proficient"]
        else:
            labels = ["Beginner", "Intermediate", "Advanced", "Expert"]

        result = self.classifier(text, labels)
        
        # The result returns labels and scores sorted by confidence
        top_label = result['labels'][0]
        confidence = result['scores'][0]

        return {
            "proficiency_level": top_label,
            "confidence": round(confidence, 4),
            "all_scores": dict(zip(result['labels'], result['scores']))
        }
