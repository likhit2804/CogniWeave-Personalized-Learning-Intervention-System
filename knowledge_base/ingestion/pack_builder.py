"""Pack builder — validates and writes extracted topic pack JSON files to disk."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from backend.app.config import settings
from knowledge_base.ingestion.topic_extractor import ExtractedTopicPack

logger = logging.getLogger(__name__)


@dataclass
class ValidationReport:
    """Report of cross-reference validation across the 6 JSON files."""
    valid: bool = True
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def add_warning(self, msg: str):
        self.warnings.append(msg)

    def add_error(self, msg: str):
        self.errors.append(msg)
        self.valid = False


def validate_pack(pack: ExtractedTopicPack) -> ValidationReport:
    """
    Validate cross-references across all six files in a topic pack.

    Checks:
    - All concept_ids referenced in misconceptions/interventions/problems/evaluation
      exist in the concept graph.
    - All misconception_ids referenced in interventions exist in misconceptions.
    - topic_id is consistent across all files.
    """
    report = ValidationReport()

    topic_id = pack.topic_id

    # Collect valid concept IDs
    concept_ids = set()
    for c in pack.concept_graph.get("concepts", []):
        cid = c.get("id")
        if cid:
            concept_ids.add(cid)

    if not concept_ids:
        report.add_error("No concepts found in concept_graph.")
        return report

    # Collect valid misconception IDs
    misconception_ids = set()
    for m in pack.misconceptions.get("items", []):
        mid = m.get("id")
        if mid:
            misconception_ids.add(mid)
        # Check concept reference
        if m.get("concept_id") not in concept_ids:
            report.add_warning(
                f"Misconception '{mid}' references unknown concept_id '{m.get('concept_id')}'."
            )

    # Validate interventions
    for rule in pack.interventions.get("rules", []):
        rid = rule.get("id", "?")
        if rule.get("concept_id") not in concept_ids:
            report.add_warning(
                f"Intervention '{rid}' references unknown concept_id '{rule.get('concept_id')}'."
            )
        if rule.get("misconception_id") not in misconception_ids:
            report.add_warning(
                f"Intervention '{rid}' references unknown misconception_id '{rule.get('misconception_id')}'."
            )

    # Validate problems
    for prob in pack.problems.get("items", []):
        pid = prob.get("id", "?")
        for cid in prob.get("concept_ids", []):
            if cid not in concept_ids:
                report.add_warning(
                    f"Problem '{pid}' references unknown concept_id '{cid}'."
                )

    # Validate evaluation rules
    for rule in pack.evaluation_rules.get("rules", []):
        if rule.get("concept_id") not in concept_ids:
            report.add_warning(
                f"Evaluation rule references unknown concept_id '{rule.get('concept_id')}'."
            )

    # Check topic_id consistency
    for file_name, data in [
        ("manifest", pack.manifest),
        ("concept_graph", pack.concept_graph),
        ("misconceptions", pack.misconceptions),
        ("interventions", pack.interventions),
        ("problems", pack.problems),
        ("evaluation_rules", pack.evaluation_rules),
    ]:
        if data.get("topic_id") != topic_id:
            report.add_warning(
                f"{file_name}.topic_id is '{data.get('topic_id')}', expected '{topic_id}'. Will be fixed on write."
            )
            data["topic_id"] = topic_id

    logger.info(
        "Validation complete: valid=%s, warnings=%d, errors=%d",
        report.valid, len(report.warnings), len(report.errors),
    )
    return report


def write_pack(
    pack: ExtractedTopicPack,
    base_dir: Path | None = None,
    overwrite: bool = False,
) -> dict[str, Any]:
    """
    Write the 6 JSON files for a topic pack to disk.

    Args:
        pack: The extracted topic pack data.
        base_dir: Override for the knowledge_base directory. Defaults to settings.
        overwrite: If True, overwrite existing files. If False, raise if folder exists.

    Returns:
        Summary dict with file paths and validation report.
    """
    root = base_dir or settings.knowledge_base_dir
    topic_dir = root / "topics" / pack.topic_id

    if topic_dir.exists() and not overwrite:
        raise FileExistsError(
            f"Topic pack '{pack.topic_id}' already exists at {topic_dir}. "
            "Set overwrite=True to replace."
        )

    topic_dir.mkdir(parents=True, exist_ok=True)

    files_map = {
        "manifest.json": pack.manifest,
        "concept_graph.json": pack.concept_graph,
        "misconceptions.json": pack.misconceptions,
        "interventions.json": pack.interventions,
        "problems.json": pack.problems,
        "evaluation_rules.json": pack.evaluation_rules,
    }

    written_files = []
    for filename, data in files_map.items():
        filepath = topic_dir / filename
        with filepath.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        written_files.append(str(filepath))
        logger.info("Wrote %s", filepath)

    return {
        "topic_id": pack.topic_id,
        "directory": str(topic_dir),
        "files": written_files,
        "concept_count": len(pack.concept_graph.get("concepts", [])),
        "misconception_count": len(pack.misconceptions.get("items", [])),
        "intervention_count": len(pack.interventions.get("rules", [])),
        "problem_count": len(pack.problems.get("items", [])),
        "evaluation_rule_count": len(pack.evaluation_rules.get("rules", [])),
    }


def build_and_write(
    pack: ExtractedTopicPack,
    base_dir: Path | None = None,
    overwrite: bool = False,
) -> dict[str, Any]:
    """Validate, then write the topic pack. Returns summary with validation report."""
    report = validate_pack(pack)

    if not report.valid:
        return {
            "success": False,
            "validation": {
                "valid": False,
                "errors": report.errors,
                "warnings": report.warnings,
            },
        }

    write_summary = write_pack(pack, base_dir=base_dir, overwrite=overwrite)

    return {
        "success": True,
        "validation": {
            "valid": True,
            "errors": [],
            "warnings": report.warnings,
        },
        **write_summary,
    }
