import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "CogniWeave"
    # parents[2] from backend/app/config.py → backend/app → backend → ml (project root)
    base_dir: Path = Path(__file__).resolve().parents[2]
    knowledge_base_dir: Path = base_dir / "knowledge_base"
    db_path: Path = base_dir / "db" / "cogniweave.db"

    # LLM Settings
    gemini_api_key: str | None = os.getenv("GEMINI_API_KEY")
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY")
    llm_model: str = "gemini-2.0-flash"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

