CREATE TABLE student_profile (
  student_id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  available_hours_per_week INTEGER NOT NULL
);

CREATE TABLE concept_mastery (
  student_id TEXT NOT NULL,
  concept TEXT NOT NULL,
  confidence_score REAL NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (student_id, concept)
);

CREATE TABLE attempts (
  attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  problem_id TEXT NOT NULL,
  concept TEXT NOT NULL,
  correct INTEGER NOT NULL,
  error_tags TEXT,
  time_seconds INTEGER,
  hints_used INTEGER,
  retries INTEGER
);

CREATE TABLE intervention_history (
  intervention_id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  concept TEXT NOT NULL,
  strategy TEXT NOT NULL,
  outcome_summary TEXT,
  created_at TEXT NOT NULL
);
