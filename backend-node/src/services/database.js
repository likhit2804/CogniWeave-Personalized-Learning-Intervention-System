/**
 * SQLite database service for CogniWeave — persistence layer
 * for students, attempts, and interventions.
 *
 * Uses native node:sqlite (synchronous) to match the original Python
 * sqlite3 usage pattern.
 */

import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import settings from "../config.js";

let db = null;

/**
 * Get or create the singleton database connection.
 */
function getDb() {
  if (db) return db;

  // Ensure parent directory exists
  const dir = path.dirname(settings.dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new DatabaseSync(settings.dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

/**
 * Create tables from schema.sql if they don't already exist.
 */
export function initDb() {
  const schemaSQL = fs.readFileSync(settings.schemaPath, "utf-8");
  const conn = getDb();
  conn.exec(schemaSQL);
  console.log(`Database initialized at ${settings.dbPath}`);
}

// --------------- Student Profile CRUD ---------------

export function upsertStudent(studentId, subject, availableHours) {
  const conn = getDb();
  conn
    .prepare(
      `INSERT INTO student_profile (student_id, subject, available_hours_per_week)
       VALUES (?, ?, ?)
       ON CONFLICT(student_id) DO UPDATE SET
         subject = excluded.subject,
         available_hours_per_week = excluded.available_hours_per_week`
    )
    .run(studentId, subject, availableHours);
}

export function getStudent(studentId) {
  const conn = getDb();
  const row = conn
    .prepare("SELECT * FROM student_profile WHERE student_id = ?")
    .get(studentId);
  return row || null;
}

// --------------- Attempts CRUD ---------------

export function recordAttempt({
  studentId,
  problemId,
  concept,
  correct,
  errorTags = [],
  timeSeconds = null,
  hintsUsed = null,
  retries = null,
}) {
  const conn = getDb();
  const result = conn
    .prepare(
      `INSERT INTO attempts (student_id, problem_id, concept, correct, error_tags,
                             time_seconds, hints_used, retries)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      studentId,
      problemId,
      concept,
      correct ? 1 : 0,
      JSON.stringify(errorTags),
      timeSeconds,
      hintsUsed,
      retries
    );
  return result.lastInsertRowid;
}

export function getAttempts(studentId, limit = 50) {
  const conn = getDb();
  const rows = conn
    .prepare(
      `SELECT * FROM attempts
       WHERE student_id = ?
       ORDER BY attempt_id DESC
       LIMIT ?`
    )
    .all(studentId, limit);

  return rows.map((row) => ({
    ...row,
    error_tags: row.error_tags ? JSON.parse(row.error_tags) : [],
    correct: Boolean(row.correct),
  }));
}

// --------------- Concept Mastery CRUD ---------------

export function updateMastery(studentId, concept, confidenceScore) {
  const now = new Date().toISOString();
  const conn = getDb();
  conn
    .prepare(
      `INSERT INTO concept_mastery (student_id, concept, confidence_score, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(student_id, concept) DO UPDATE SET
         confidence_score = excluded.confidence_score,
         updated_at = excluded.updated_at`
    )
    .run(studentId, concept, confidenceScore, now);
}

export function getMastery(studentId) {
  const conn = getDb();
  const rows = conn
    .prepare(
      "SELECT concept, confidence_score FROM concept_mastery WHERE student_id = ?"
    )
    .all(studentId);

  const result = {};
  for (const row of rows) {
    result[row.concept] = row.confidence_score;
  }
  return result;
}

// --------------- Intervention History CRUD ---------------

export function recordIntervention({
  studentId,
  concept,
  strategy,
  outcomeSummary = null,
}) {
  const now = new Date().toISOString();
  const conn = getDb();
  const result = conn
    .prepare(
      `INSERT INTO intervention_history (student_id, concept, strategy, outcome_summary, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(studentId, concept, strategy, outcomeSummary, now);
  return result.lastInsertRowid;
}

export function getInterventions(studentId, limit = 20) {
  const conn = getDb();
  return conn
    .prepare(
      `SELECT * FROM intervention_history
       WHERE student_id = ?
       ORDER BY intervention_id DESC
       LIMIT ?`
    )
    .all(studentId, limit);
}
