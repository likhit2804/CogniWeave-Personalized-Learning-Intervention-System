"""API routes for textbook ingestion and topic pack management."""

from __future__ import annotations

import logging
import tempfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from backend.app.config import settings
from knowledge_base.ingestion.pack_builder import build_and_write, validate_pack
from knowledge_base.ingestion.textbook_parser import parse_pdf, parse_text
from knowledge_base.ingestion.topic_extractor import extract_topic_pack

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ingest", tags=["ingestion"])


# --------------- Request/Response Models ---------------

class TextIngestionRequest(BaseModel):
    """Ingest raw text content (chapter from a textbook)."""
    topic_id: str
    title: str = ""
    content: str
    chapter_index: int = 0
    overwrite: bool = False


class IngestionResponse(BaseModel):
    """Response from the ingestion pipeline."""
    success: bool
    topic_id: str
    message: str
    directory: str = ""
    stats: dict[str, Any] = {}
    validation: dict[str, Any] = {}
    generated_data: dict[str, Any] = {}


class TopicListItem(BaseModel):
    topic_id: str
    title: str
    difficulty: str
    description: str


# --------------- Endpoints ---------------

@router.post("/text", response_model=IngestionResponse)
def ingest_text(request: TextIngestionRequest) -> IngestionResponse:
    """
    Ingest raw text content and generate a complete topic pack.

    Send a chapter of textbook content as plain text. The system will:
    1. Parse the text into sections
    2. Run 5-pass LLM extraction (concepts, misconceptions, interventions, problems, eval rules)
    3. Validate cross-references
    4. Write 6 JSON files to knowledge_base/topics/<topic_id>/
    """
    try:
        # Parse text
        parsed = parse_text(request.content, source_name=request.title or "api_input")

        if not parsed.chapters:
            raise HTTPException(status_code=400, detail="No content could be parsed from the input.")

        chapter_idx = min(request.chapter_index, len(parsed.chapters) - 1)
        chapter = parsed.chapters[chapter_idx]

        # Extract via LLM
        pack = extract_topic_pack(
            chapter_content=chapter.content,
            chapter_title=request.title or chapter.chapter_title,
            topic_id=request.topic_id,
        )

        # Validate and write
        result = build_and_write(pack, overwrite=request.overwrite)

        if result["success"]:
            return IngestionResponse(
                success=True,
                topic_id=request.topic_id,
                message=f"Topic pack '{request.topic_id}' generated successfully.",
                directory=result.get("directory", ""),
                stats={
                    "concepts": result.get("concept_count", 0),
                    "misconceptions": result.get("misconception_count", 0),
                    "interventions": result.get("intervention_count", 0),
                    "problems": result.get("problem_count", 0),
                    "evaluation_rules": result.get("evaluation_rule_count", 0),
                },
                validation=result.get("validation", {}),
                generated_data={
                    "manifest": pack.manifest,
                    "concept_graph": pack.concept_graph,
                    "misconceptions": pack.misconceptions,
                    "interventions": pack.interventions,
                    "problems": pack.problems,
                    "evaluation_rules": pack.evaluation_rules,
                },
            )
        else:
            return IngestionResponse(
                success=False,
                topic_id=request.topic_id,
                message="Validation failed. Topic pack was not written.",
                validation=result.get("validation", {}),
            )

    except Exception as e:
        logger.exception("Ingestion failed for topic '%s'", request.topic_id)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pdf", response_model=IngestionResponse)
async def ingest_pdf(
    file: UploadFile = File(...),
    topic_id: str = Form(...),
    title: str = Form(""),
    chapter_index: int = Form(0),
    overwrite: bool = Form(False),
) -> IngestionResponse:
    """
    Upload a PDF textbook and generate a topic pack from a selected chapter.

    The PDF is parsed page-by-page, chapters are detected by heading patterns,
    and the selected chapter is processed through the 5-pass LLM extraction pipeline.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)

        # Parse PDF
        parsed = parse_pdf(tmp_path)

        if not parsed.chapters:
            raise HTTPException(
                status_code=400,
                detail=f"No chapters could be extracted from '{file.filename}'.",
            )

        chapter_idx = min(chapter_index, len(parsed.chapters) - 1)
        chapter = parsed.chapters[chapter_idx]

        # Extract via LLM
        pack = extract_topic_pack(
            chapter_content=chapter.content,
            chapter_title=title or chapter.chapter_title,
            topic_id=topic_id,
        )

        # Validate and write
        result = build_and_write(pack, overwrite=overwrite)

        # Cleanup temp file
        tmp_path.unlink(missing_ok=True)

        if result["success"]:
            return IngestionResponse(
                success=True,
                topic_id=topic_id,
                message=f"Topic pack '{topic_id}' generated from PDF chapter '{chapter.chapter_title}'.",
                directory=result.get("directory", ""),
                stats={
                    "concepts": result.get("concept_count", 0),
                    "misconceptions": result.get("misconception_count", 0),
                    "interventions": result.get("intervention_count", 0),
                    "problems": result.get("problem_count", 0),
                    "evaluation_rules": result.get("evaluation_rule_count", 0),
                },
                validation=result.get("validation", {}),
                generated_data={
                    "manifest": pack.manifest,
                    "concept_graph": pack.concept_graph,
                },
            )
        else:
            return IngestionResponse(
                success=False,
                topic_id=topic_id,
                message="Validation failed. Topic pack was not written.",
                validation=result.get("validation", {}),
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("PDF ingestion failed for topic '%s'", topic_id)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/topics", response_model=list[TopicListItem])
def list_topics() -> list[TopicListItem]:
    """List all available topic packs in the knowledge base."""
    import json

    topics_dir = settings.knowledge_base_dir / "topics"
    if not topics_dir.exists():
        return []

    results = []
    for topic_dir in sorted(topics_dir.iterdir()):
        manifest_path = topic_dir / "manifest.json"
        if topic_dir.is_dir() and manifest_path.exists():
            with manifest_path.open("r", encoding="utf-8") as f:
                manifest = json.load(f)
            results.append(TopicListItem(
                topic_id=manifest.get("topic_id", topic_dir.name),
                title=manifest.get("title", topic_dir.name),
                difficulty=manifest.get("difficulty", "unknown"),
                description=manifest.get("description", ""),
            ))

    return results
