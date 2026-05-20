import json
from pathlib import Path
from typing import Any

from backend.app.config import settings


def _read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


class KnowledgeBase:
    """Loads a topic pack used by the agents."""

    def __init__(self, topic_id: str, base_dir: Path | None = None) -> None:
        self.topic_id = topic_id
        root = base_dir or settings.knowledge_base_dir
        self.base_dir = root / "topics" / topic_id
        self.manifest = _read_json(self.base_dir / "manifest.json")
        self.concepts = _read_json(self.base_dir / "concept_graph.json")
        self.misconceptions = _read_json(self.base_dir / "misconceptions.json")
        self.interventions = _read_json(self.base_dir / "interventions.json")
        self.problems = _read_json(self.base_dir / "problems.json")
        self.evaluation_rules = _read_json(self.base_dir / "evaluation_rules.json")

    def find_misconception(self, concept: str, error_tag: str | None) -> dict[str, Any] | None:
        for item in self.misconceptions["items"]:
            if item["concept_id"] == concept and error_tag in item.get("error_tags", []):
                return item
        return None

    def find_interventions(self, concept: str, error_tag: str | None) -> list[dict[str, Any]]:
        matches = []
        for item in self.interventions["rules"]:
            if item["concept_id"] != concept:
                continue
            misconception = self.find_misconception(concept, error_tag)
            if misconception and item["misconception_id"] == misconception["id"]:
                matches.append(item)
        return matches
