from langchain_openai import ChatOpenAI
from backend.app.config import settings

# shared llm instance for all agents
# we use gpt-4o because structured output requires a strong model
llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0,
    api_key=settings.openai_api_key or "mock-key-for-tests"
)
