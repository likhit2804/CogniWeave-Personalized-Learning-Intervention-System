from pathlib import Path

from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "CogniWeave"
    base_dir: Path = Path(__file__).resolve().parents[2]
    knowledge_base_dir: Path = base_dir / "knowledge_base"


settings = Settings()
