"""Topic extractor — LLM-powered multi-pass extraction from textbook content."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any

from knowledge_base.ingestion.prompts import (
    CONCEPT_EXTRACTION_PROMPT,
    EVALUATION_RULES_PROMPT,
    INTERVENTION_GENERATION_PROMPT,
    MISCONCEPTION_GENERATION_PROMPT,
    PROBLEM_GENERATION_PROMPT,
)

logger = logging.getLogger(__name__)


@dataclass
class ExtractedTopicPack:
    """All six JSON structures extracted from a textbook chapter."""
    topic_id: str
    manifest: dict[str, Any] = field(default_factory=dict)
    concept_graph: dict[str, Any] = field(default_factory=dict)
    misconceptions: dict[str, Any] = field(default_factory=dict)
    interventions: dict[str, Any] = field(default_factory=dict)
    problems: dict[str, Any] = field(default_factory=dict)
    evaluation_rules: dict[str, Any] = field(default_factory=dict)


def _extract_json_from_response(text: str) -> dict[str, Any]:
    """Extract JSON from an LLM response that may include markdown fences."""
    # Try to find JSON in markdown code blocks first
    match = re.search(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL)
    if match:
        text = match.group(1)

    # Strip any leading/trailing whitespace
    text = text.strip()

    return json.loads(text)


def extract_topic_pack(
    chapter_content: str,
    chapter_title: str,
    topic_id: str,
    llm=None,
) -> ExtractedTopicPack:
    """
    Run the full multi-pass extraction pipeline on a single chapter.

    Pass 1: Extract concepts and hierarchy
    Pass 2: Generate misconceptions
    Pass 3: Generate interventions
    Pass 4: Generate problems
    Pass 5: Generate evaluation rules

    Args:
        chapter_content: The raw text content of the chapter.
        chapter_title: The title of the chapter.
        topic_id: The snake_case identifier for the topic.
        llm: A LangChain chat model instance (if None, uses get_llm()).

    Returns:
        An ExtractedTopicPack with all six JSON structures.
    """
    if llm is None:
        from backend.app.services.llm_client import get_llm
        llm = get_llm(temperature=0.3)

    result = ExtractedTopicPack(topic_id=topic_id)

    # Truncate content if it's extremely long (protect against token limits)
    max_chars = 80_000  # ~20K tokens, safe for most models
    truncated_content = chapter_content[:max_chars]
    if len(chapter_content) > max_chars:
        logger.warning(
            "Chapter content truncated from %d to %d chars for LLM processing.",
            len(chapter_content), max_chars,
        )

    # ---- Pass 1: Concept Extraction ----
    logger.info("Pass 1/5: Extracting concepts from '%s'...", chapter_title)
    prompt_1 = CONCEPT_EXTRACTION_PROMPT.format(
        chapter_title=chapter_title,
        chapter_content=truncated_content,
        topic_id=topic_id,
    )
    response_1 = llm.invoke(prompt_1)
    concepts_data = _extract_json_from_response(response_1.content)

    # Build manifest from extracted data
    result.manifest = {
        "topic_id": topic_id,
        "title": concepts_data.get("title", chapter_title),
        "version": "0.1.0",
        "difficulty": concepts_data.get("difficulty", "intermediate"),
        "target_users": ["engineering_students"],
        "description": concepts_data.get("description", f"Auto-generated topic pack from: {chapter_title}"),
    }
    result.concept_graph = {
        "topic_id": topic_id,
        "concepts": concepts_data.get("concepts", []),
    }

    concepts_json = json.dumps(concepts_data.get("concepts", []), indent=2)
    topic_title = result.manifest["title"]

    # ---- Pass 2: Misconception Generation ----
    logger.info("Pass 2/5: Generating misconceptions...")
    prompt_2 = MISCONCEPTION_GENERATION_PROMPT.format(
        topic_title=topic_title,
        concepts_json=concepts_json,
        chapter_content=truncated_content[:40_000],  # Shorter for context
        topic_id=topic_id,
    )
    response_2 = llm.invoke(prompt_2)
    misconceptions_data = _extract_json_from_response(response_2.content)
    result.misconceptions = misconceptions_data

    misconceptions_json = json.dumps(misconceptions_data.get("items", []), indent=2)

    # Collect all error tags for problem generation
    all_error_tags = []
    for item in misconceptions_data.get("items", []):
        all_error_tags.extend(item.get("error_tags", []))

    # ---- Pass 3: Intervention Generation ----
    logger.info("Pass 3/5: Generating interventions...")
    prompt_3 = INTERVENTION_GENERATION_PROMPT.format(
        topic_title=topic_title,
        misconceptions_json=misconceptions_json,
        chapter_content=truncated_content[:40_000],
        topic_id=topic_id,
    )
    response_3 = llm.invoke(prompt_3)
    interventions_data = _extract_json_from_response(response_3.content)
    result.interventions = interventions_data

    # ---- Pass 4: Problem Generation ----
    logger.info("Pass 4/5: Generating practice problems...")
    # Create a short prefix from topic_id (first 3 chars of each word)
    topic_prefix = "_".join(w[:3] for w in topic_id.split("_")[:2])

    prompt_4 = PROBLEM_GENERATION_PROMPT.format(
        topic_title=topic_title,
        topic_prefix=topic_prefix,
        concepts_json=concepts_json,
        error_tags_json=json.dumps(list(set(all_error_tags)), indent=2),
        topic_id=topic_id,
    )
    response_4 = llm.invoke(prompt_4)
    problems_data = _extract_json_from_response(response_4.content)
    result.problems = problems_data

    # ---- Pass 5: Evaluation Rules ----
    logger.info("Pass 5/5: Generating evaluation rules...")
    prompt_5 = EVALUATION_RULES_PROMPT.format(
        topic_title=topic_title,
        concepts_json=concepts_json,
        interventions_json=json.dumps(interventions_data.get("rules", []), indent=2),
        topic_id=topic_id,
    )
    response_5 = llm.invoke(prompt_5)
    evaluation_data = _extract_json_from_response(response_5.content)
    result.evaluation_rules = evaluation_data

    logger.info("Extraction complete for topic '%s'.", topic_id)
    return result
