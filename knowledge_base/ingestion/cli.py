"""CLI entry point for textbook ingestion."""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

# Ensure project root is on sys.path so imports work when run as a script
_project_root = Path(__file__).resolve().parents[2]
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from knowledge_base.ingestion.textbook_parser import parse_pdf, parse_text
from knowledge_base.ingestion.topic_extractor import extract_topic_pack
from knowledge_base.ingestion.pack_builder import build_and_write, validate_pack


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(
        description="Ingest a textbook chapter and generate a CogniWeave topic pack.",
        epilog="Example: python -m knowledge_base.ingestion.cli --input chapter1.pdf --topic-id data_structures_trees",
    )
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="Path to input file (PDF or .txt/.md text file).",
    )
    parser.add_argument(
        "--topic-id", "-t",
        required=True,
        help="snake_case topic identifier (e.g., 'data_structures_trees').",
    )
    parser.add_argument(
        "--chapter", "-c",
        type=int,
        default=None,
        help="Chapter index to process (0-based). If omitted, processes the first chapter.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing topic pack if it already exists.",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Parse and extract but don't write files (dry run).",
    )

    args = parser.parse_args()
    input_path = Path(args.input)

    if not input_path.exists():
        logger.error("Input file not found: %s", input_path)
        sys.exit(1)

    # Step 1: Parse
    logger.info("Parsing input file: %s", input_path)
    if input_path.suffix.lower() == ".pdf":
        parsed = parse_pdf(input_path)
    else:
        raw_text = input_path.read_text(encoding="utf-8")
        parsed = parse_text(raw_text, source_name=str(input_path))

    logger.info("Parsed result:\n%s", parsed.summary())

    if not parsed.chapters:
        logger.error("No chapters found in the input file.")
        sys.exit(1)

    # Select chapter
    chapter_idx = args.chapter if args.chapter is not None else 0
    if chapter_idx >= len(parsed.chapters):
        logger.error(
            "Chapter index %d is out of range. Found %d chapters.",
            chapter_idx, len(parsed.chapters),
        )
        sys.exit(1)

    chapter = parsed.chapters[chapter_idx]
    logger.info(
        "Processing chapter %d: '%s' (%d words)",
        chapter_idx, chapter.chapter_title, chapter.word_count,
    )

    # Step 2: Extract via LLM
    logger.info("Starting LLM extraction pipeline (5 passes)...")
    pack = extract_topic_pack(
        chapter_content=chapter.content,
        chapter_title=chapter.chapter_title,
        topic_id=args.topic_id,
    )

    # Step 3: Validate
    report = validate_pack(pack)
    if report.warnings:
        logger.warning("Validation warnings:")
        for w in report.warnings:
            logger.warning("  - %s", w)
    if report.errors:
        logger.error("Validation errors:")
        for e in report.errors:
            logger.error("  - %s", e)

    if args.validate_only:
        logger.info("Dry run complete. No files written.")
        return

    # Step 4: Write
    result = build_and_write(pack, overwrite=args.overwrite)

    if result["success"]:
        logger.info("✅ Topic pack written successfully!")
        logger.info("  Directory: %s", result["directory"])
        logger.info("  Concepts: %d", result["concept_count"])
        logger.info("  Misconceptions: %d", result["misconception_count"])
        logger.info("  Interventions: %d", result["intervention_count"])
        logger.info("  Problems: %d", result["problem_count"])
        logger.info("  Evaluation rules: %d", result["evaluation_rule_count"])
    else:
        logger.error("❌ Failed to write topic pack.")
        for e in result.get("validation", {}).get("errors", []):
            logger.error("  - %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
