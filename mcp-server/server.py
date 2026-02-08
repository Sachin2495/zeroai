from mcp.server.fastmcp import FastMCP
from tools.resume_parser import ResumeParser
from tools.skill_matcher import SkillMatcher
from tools.proficiency_scorer import ProficiencyScorer

class ZaraMCPServer:
    def __init__(self, name: str = "Zara Interview Tools"):
        self.mcp = FastMCP(name)
        
        # Initialize Tools
        # We initialize them here so they persist across calls
        print("Initializing Zara Tools...")
        self.resume_parser = ResumeParser()
        self.skill_matcher = SkillMatcher()
        self.proficiency_scorer = ProficiencyScorer()
        print("Zara Tools Initialized.")

        self.register_tools()

    def register_tools(self):
        """Register all tool capabilities."""
        self.mcp.tool()(self.parse_resume)
        self.mcp.tool()(self.match_skills)
        self.mcp.tool()(self.assess_proficiency)

    def parse_resume(self, file_content: str) -> dict:
        """
        Parses a resume text to extract skills and experience using BERT NER.
        """
        return self.resume_parser.parse(file_content)

    def match_skills(self, candidate_text: str, job_description: str) -> dict:
        """
        Calculates match percentage and feedback between candidate and job description.
        """
        return self.skill_matcher.match(candidate_text, job_description)

    def assess_proficiency(self, text: str, domain: str = "general") -> dict:
        """
        Assesses proficiency level (Language or Technical) from text using Zero-Shot Classification.
        """
        return self.proficiency_scorer.assess(text, domain)

    def run(self):
        self.mcp.run()

if __name__ == "__main__":
    server = ZaraMCPServer()
    server.run()