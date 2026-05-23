from langchain_openai import ChatOpenAI
from backend.app.config import settings


def get_llm():
    """Returns a ChatOpenAI client with automated retry policies."""
    return ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.2,
        openai_api_key=settings.openai_api_key,
        max_retries=3
    )
