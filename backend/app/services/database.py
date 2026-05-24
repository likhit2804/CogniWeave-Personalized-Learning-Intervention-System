"""SQLite database service for CogniWeave — persistence layer for students, attempts, and interventions."""

from __future__ import annotations

import json
import logging
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Generator

from backend.app.config import settings

logger = logging.getLogger(__name__)

# Path to the SQL schema file
_SCHEMA_PATH = settings.base_dir / "db" / "schema.sql"


def _get_db_path() -> Path:
    """Return the database file path, creating parent dirs if needed."""
    db_path = settings.db_path
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return db_path


@contextmanager
def get_connection() -> Generator[sqlite3.Connection, None, None]:
    """Context manager for SQLite connections with WAL mode and foreign keys."""
    conn = sqlite3.connect(str(_get_db_path()))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Create tables from schema.sql if they don't already exist."""
    schema_sql = _SCHEMA_PATH.read_text(encoding="utf-8")
    with get_connection() as conn:
        conn.executescript(schema_sql)
    logger.info("Database initialized at %s", _get_db_path())


# --------------- Student Profile CRUD ---------------

def upsert_student(student_id: str, subject: str, available_hours: int) -> None:
    """Insert or update a student profile."""
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO student_profile (student_id, subject, available_hours_per_week)
            VALUES (?, ?, ?)
            ON CONFLICT(student_id) DO UPDATE SET
                subject = excluded.subject,
                available_hours_per_week = excluded.available_hours_per_week
            """,
            (student_id, subject, available_hours),
        )


def get_student(student_id: str) -> dict[str, Any] | None:
    """Retrieve a student profile by ID."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM student_profile WHERE student_id = ?",
            (student_id,),
        ).fetchone()
    return dict(row) if row else None


# --------------- Attempts CRUD ---------------

def record_attempt(
    student_id: str,
    problem_id: str,
    concept: str,
    correct: bool,
    error_tags: list[str] | None = None,
    time_seconds: int | None = None,
    hints_used: int | None = None,
    retries: int | None = None,
) -> int:
    """Record a student attempt and return the new attempt_id."""
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO attempts (student_id, problem_id, concept, correct, error_tags,
                                  time_seconds, hints_used, retries)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                student_id, problem_id, concept, int(correct),
                json.dumps(error_tags or []),
                time_seconds, hints_used, retries,
            ),
        )
        return cursor.lastrowid


def get_attempts(student_id: str, limit: int = 50) -> list[dict[str, Any]]:
    """Retrieve recent attempts for a student."""
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM attempts
            WHERE student_id = ?
            ORDER BY attempt_id DESC
            LIMIT ?
            """,
            (student_id, limit),
        ).fetchall()

    results = []
    for row in rows:
        d = dict(row)
        # Parse error_tags back from JSON string
        if d.get("error_tags"):
            d["error_tags"] = json.loads(d["error_tags"])
        else:
            d["error_tags"] = []
        d["correct"] = bool(d["correct"])
        results.append(d)
    return results


# --------------- Concept Mastery CRUD ---------------

def update_mastery(student_id: str, concept: str, confidence_score: float) -> None:
    """Update or insert a concept mastery score."""
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO concept_mastery (student_id, concept, confidence_score, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(student_id, concept) DO UPDATE SET
                confidence_score = excluded.confidence_score,
                updated_at = excluded.updated_at
            """,
            (student_id, concept, confidence_score, now),
        )


def get_mastery(student_id: str) -> dict[str, float]:
    """Get all concept mastery scores for a student as {concept: score}."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT concept, confidence_score FROM concept_mastery WHERE student_id = ?",
            (student_id,),
        ).fetchall()
    return {row["concept"]: row["confidence_score"] for row in rows}


# --------------- Intervention History CRUD ---------------

def record_intervention(
    student_id: str,
    concept: str,
    strategy: str,
    outcome_summary: str | None = None,
) -> int:
    """Record an intervention and return the new intervention_id."""
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO intervention_history (student_id, concept, strategy, outcome_summary, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (student_id, concept, strategy, outcome_summary, now),
        )
        return cursor.lastrowid


def get_interventions(student_id: str, limit: int = 20) -> list[dict[str, Any]]:
    """Retrieve recent interventions for a student."""
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM intervention_history
            WHERE student_id = ?
            ORDER BY intervention_id DESC
            LIMIT ?
            """,
            (student_id, limit),
        ).fetchall()
    return [dict(row) for row in rows]
