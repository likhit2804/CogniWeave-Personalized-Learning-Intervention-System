from langchain_google_genai import ChatGoogleGenerativeAI
from backend.app.config import settings


def get_llm(temperature: float = 0.2):
    """Returns a Gemini chat model via LangChain with retry policies."""
    return ChatGoogleGenerativeAI(
        model=settings.llm_model,
        temperature=temperature,
        google_api_key=settings.gemini_api_key,
        max_retries=3,
    )
