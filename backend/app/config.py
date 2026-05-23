import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "CogniWeave"
    base_dir: Path = Path(__file__).resolve().parents[2]
    knowledge_base_dir: Path = base_dir / "knowledge_base"

    # LLM Settings
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY")

    model_config = {"env_file": ".env"}


settings = Settings()

