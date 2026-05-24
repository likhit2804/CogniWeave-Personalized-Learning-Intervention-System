"""Tests for the textbook ingestion pipeline."""

import json
import sys
import tempfile
from pathlib import Path

# Ensure project root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from knowledge_base.ingestion.textbook_parser import parse_text, ChapterChunk, ParsedTextbook
from knowledge_base.ingestion.pack_builder import validate_pack
from knowledge_base.ingestion.topic_extractor import ExtractedTopicPack


# --------------- Parser Tests ---------------

def test_parse_text_with_markdown_headings():
    """Test that markdown headings are detected as chapter boundaries."""
    raw = """# Introduction to Trees

Trees are hierarchical data structures.

## Binary Trees

A binary tree has at most two children per node.

## Binary Search Trees

BSTs maintain an ordering property.
"""
    parsed = parse_text(raw, source_name="test")
    assert isinstance(parsed, ParsedTextbook)
    assert len(parsed.chapters) >= 2
    assert parsed.total_words > 0


def test_parse_text_single_block():
    """Test that text without headings creates a single chapter."""
    raw = "This is a simple paragraph about data structures with no headings at all."
    parsed = parse_text(raw, source_name="test_simple")
    assert len(parsed.chapters) >= 1
    assert parsed.chapters[0].word_count > 0


def test_parse_text_empty_raises():
    """Test that empty text raises ValueError."""
    import pytest
    with pytest.raises(ValueError, match="Empty"):
        parse_text("   ", source_name="empty")


# --------------- Validation Tests ---------------

def _make_valid_pack() -> ExtractedTopicPack:
    """Create a minimal valid topic pack for testing."""
    return ExtractedTopicPack(
        topic_id="test_topic",
        manifest={
            "topic_id": "test_topic",
            "title": "Test Topic",
            "version": "0.1.0",
            "difficulty": "beginner",
            "target_users": ["students"],
            "description": "A test topic.",
        },
        concept_graph={
            "topic_id": "test_topic",
            "concepts": [
                {
                    "id": "concept_a",
                    "label": "Concept A",
                    "description": "First concept.",
                    "prerequisites": [],
                    "related_concepts": [],
                },
                {
                    "id": "concept_b",
                    "label": "Concept B",
                    "description": "Second concept.",
                    "prerequisites": ["concept_a"],
                    "related_concepts": [],
                },
            ],
        },
        misconceptions={
            "topic_id": "test_topic",
            "items": [
                {
                    "id": "miscon_a1",
                    "concept_id": "concept_a",
                    "label": "Common mistake A",
                    "error_tags": ["error_a1"],
                    "symptoms": ["symptom 1"],
                    "notes": "Explanation.",
                },
            ],
        },
        interventions={
            "topic_id": "test_topic",
            "rules": [
                {
                    "id": "fix_a1",
                    "concept_id": "concept_a",
                    "misconception_id": "miscon_a1",
                    "strategy": "Drill A",
                    "activities": ["Do activity 1"],
                    "expected_signals": ["improvement"],
                    "priority": 1,
                },
            ],
        },
        problems={
            "topic_id": "test_topic",
            "items": [
                {
                    "id": "prob_001",
                    "title": "Test problem",
                    "concept_ids": ["concept_a"],
                    "difficulty": "easy",
                    "problem_type": "conceptual",
                    "skills_tested": ["skill_1"],
                    "expected_error_tags": ["error_a1"],
                },
            ],
        },
        evaluation_rules={
            "topic_id": "test_topic",
            "rules": [
                {
                    "concept_id": "concept_a",
                    "success_signals": ["higher correctness"],
                    "partial_success_conditions": ["some improvement"],
                    "replan_trigger": ["same error repeats"],
                },
            ],
        },
    )


def test_validate_valid_pack():
    """A well-formed pack should pass validation."""
    pack = _make_valid_pack()
    report = validate_pack(pack)
    assert report.valid is True
    assert len(report.errors) == 0


def test_validate_bad_concept_ref():
    """A misconception referencing a non-existent concept should produce a warning."""
    pack = _make_valid_pack()
    pack.misconceptions["items"].append({
        "id": "miscon_bad",
        "concept_id": "nonexistent_concept",
        "label": "Bad ref",
        "error_tags": ["bad_tag"],
        "symptoms": [],
        "notes": "",
    })
    report = validate_pack(pack)
    assert any("nonexistent_concept" in w for w in report.warnings)


def test_validate_empty_concepts_is_error():
    """A pack with no concepts should fail validation."""
    pack = _make_valid_pack()
    pack.concept_graph["concepts"] = []
    report = validate_pack(pack)
    assert report.valid is False
    assert any("No concepts" in e for e in report.errors)


# --------------- Pack Builder Write Tests ---------------

def test_write_pack_creates_files():
    """Test that build_and_write creates all 6 JSON files."""
    from knowledge_base.ingestion.pack_builder import build_and_write

    pack = _make_valid_pack()

    with tempfile.TemporaryDirectory() as tmpdir:
        base = Path(tmpdir)
        result = build_and_write(pack, base_dir=base, overwrite=True)

        assert result["success"] is True
        topic_dir = base / "topics" / "test_topic"
        assert topic_dir.exists()

        expected_files = [
            "manifest.json",
            "concept_graph.json",
            "misconceptions.json",
            "interventions.json",
            "problems.json",
            "evaluation_rules.json",
        ]
        for fname in expected_files:
            fpath = topic_dir / fname
            assert fpath.exists(), f"Missing {fname}"
            data = json.loads(fpath.read_text())
            assert data.get("topic_id") == "test_topic"
