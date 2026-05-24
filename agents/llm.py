from langchain_google_genai import ChatGoogleGenerativeAI
from backend.app.config import settings

# shared llm instance for all agents
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0,
    api_key=settings.gemini_api_key or "mock-key-for-tests"
)
