import os
from dotenv import load_dotenv

load_dotenv()

DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b"


def get_llm(temperature: float = 0.7):
    """Returns the configured chat model. Groq in deployed environments, Ollama for local dev."""
    provider = os.getenv("LLM_PROVIDER", "groq").lower()

    if provider == "groq":
        from langchain_groq import ChatGroq

        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not set")
        return ChatGroq(
            temperature=temperature,
            model_name=os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL),
            api_key=api_key,
        )

    from langchain_ollama import ChatOllama

    return ChatOllama(
        model=os.getenv("OLLAMA_MODEL", "llama3:latest"),
        temperature=temperature,
        base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
    )
