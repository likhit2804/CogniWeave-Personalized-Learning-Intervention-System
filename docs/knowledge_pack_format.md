# Knowledge Pack Format

The easiest way to keep this project broad is to separate the core engine from the topic-specific knowledge.

The cleanest approach is:

- one shared agent pipeline
- one shared memory format
- one `topic pack` per subject area

Each topic pack should live in its own folder and carry the same file structure.

## Recommended Folder Layout

```text
knowledge_base/
  topics/
    sql_query_reasoning/
      manifest.json
      concept_graph.json
      misconceptions.json
      interventions.json
      problems.json
      evaluation_rules.json
    os_synchronization/
      manifest.json
      concept_graph.json
      misconceptions.json
      interventions.json
      problems.json
      evaluation_rules.json
    dbms_normalization/
      manifest.json
      concept_graph.json
      misconceptions.json
      interventions.json
      problems.json
      evaluation_rules.json
```

This keeps each topic self-contained.

## Why This Layout Works

Each pack answers a different question:

- `manifest.json`: what topic is this
- `concept_graph.json`: what concepts depend on what
- `misconceptions.json`: what students usually get wrong
- `interventions.json`: what to do for each mistake
- `problems.json`: what practice items exist and what they test
- `evaluation_rules.json`: how success should be judged

That separation makes the system easier to debug and easier to extend later.

## 1. `manifest.json`

This is a small metadata file for the topic pack.

Example:

```json
{
  "topic_id": "sql_query_reasoning",
  "title": "SQL Query Reasoning",
  "version": "0.1.0",
  "difficulty": "intermediate",
  "target_users": ["engineering_students"],
  "description": "Structured SQL reasoning pack covering joins, aggregation, filtering, subqueries, and NULL behavior."
}
```

Use this file to:

- identify the pack
- show the topic title in the UI
- keep versioning simple

## 2. `concept_graph.json`

This defines the sub-skills and their dependencies.

This is the most important grounded file.

Recommended format:

```json
{
  "topic_id": "sql_query_reasoning",
  "concepts": [
    {
      "id": "joins",
      "label": "Joins",
      "description": "Combining rows from multiple tables using matching keys.",
      "prerequisites": ["table_structure", "foreign_keys"],
      "related_concepts": ["left_join_behavior", "duplicate_rows"]
    },
    {
      "id": "group_by",
      "label": "GROUP BY",
      "description": "Grouping rows before aggregate computation.",
      "prerequisites": ["basic_select", "aggregate_functions"],
      "related_concepts": ["having", "duplicate_counting"]
    }
  ]
}
```

### Rules for this file

- each concept should have a stable `id`
- prerequisites should point to other concept IDs
- keep descriptions short and useful
- do not overload this file with interventions or mistakes

This file should answer:

`What are the sub-skills in this topic, and how are they connected?`

## 3. `misconceptions.json`

This stores recurring student mistakes.

Recommended format:

```json
{
  "topic_id": "sql_query_reasoning",
  "items": [
    {
      "id": "join_wrong_key",
      "concept_id": "joins",
      "label": "Wrong join condition",
      "error_tags": ["wrong_join_key", "cartesian_like_output"],
      "symptoms": [
        "unexpected duplicate rows",
        "incorrect record count",
        "irrelevant row combinations"
      ],
      "notes": "Often happens when the student joins on similar-looking but unrelated columns."
    },
    {
      "id": "where_vs_having_confusion",
      "concept_id": "group_by",
      "label": "WHERE vs HAVING confusion",
      "error_tags": ["filter_after_aggregation_error"],
      "symptoms": [
        "aggregate filter written in WHERE",
        "query fails or returns logically wrong rows"
      ],
      "notes": "Usually appears when the student understands aggregation but not query order."
    }
  ]
}
```

### Rules for this file

- each misconception needs a stable `id`
- it should map to one main `concept_id`
- `error_tags` should match what the diagnosis layer emits
- `symptoms` should be observable from student data

This file should answer:

`Given a mistake pattern, what misunderstanding does it probably point to?`

## 4. `interventions.json`

This stores what the system should do once it has diagnosed a misconception.

Recommended format:

```json
{
  "topic_id": "sql_query_reasoning",
  "rules": [
    {
      "id": "fix_join_reasoning",
      "concept_id": "joins",
      "misconception_id": "join_wrong_key",
      "strategy": "Join debugging drill",
      "activities": [
        "Compare two join conditions and predict row counts before execution.",
        "Run a small join example and explain why duplicates appear."
      ],
      "expected_signals": [
        "fewer join-key mistakes",
        "better output prediction",
        "lower retry count"
      ],
      "priority": 1
    }
  ]
}
```

### Rules for this file

- connect intervention rules to a `misconception_id`
- keep `activities` concrete
- define `expected_signals` so evaluation has something to check
- allow multiple interventions for one misconception later

This file should answer:

`If this is the problem, what is the next best corrective action?`

## 5. `problems.json`

This stores the practice items or references to them.

Recommended format:

```json
{
  "topic_id": "sql_query_reasoning",
  "items": [
    {
      "id": "sql_001",
      "title": "Count students per department",
      "concept_ids": ["group_by", "aggregate_functions"],
      "difficulty": "easy",
      "problem_type": "aggregation",
      "skills_tested": ["grouping", "count_usage"],
      "expected_error_tags": ["where_vs_having_confusion", "duplicate_counting"]
    },
    {
      "id": "sql_002",
      "title": "List students with advisor names",
      "concept_ids": ["joins"],
      "difficulty": "medium",
      "problem_type": "join",
      "skills_tested": ["join_key_selection"],
      "expected_error_tags": ["wrong_join_key"]
    }
  ]
}
```

### Rules for this file

- each problem should list the concepts it tests
- this file does not need full solutions at first
- `expected_error_tags` helps diagnosis and evaluation

This file should answer:

`What practice items exist, and what do they measure?`

## 6. `evaluation_rules.json`

This defines how the system decides whether an intervention worked.

Recommended format:

```json
{
  "topic_id": "sql_query_reasoning",
  "rules": [
    {
      "concept_id": "joins",
      "success_signals": [
        "higher correctness on similar join problems",
        "fewer repeated join-key mistakes",
        "lower hint usage",
        "better output prediction accuracy"
      ],
      "partial_success_conditions": [
        "correct final query but repeated retries",
        "correct output with low confidence"
      ],
      "replan_trigger": [
        "same error tag appears in two later attempts",
        "student still cannot explain why the query works"
      ]
    }
  ]
}
```

### Rules for this file

- define success at concept level
- include partial success, not just success/failure
- include replanning rules

This file should answer:

`How will the system know whether the intervention actually helped?`

## Recommended Naming Rules

Use:

- snake_case for file names
- stable lowercase IDs
- short but clear labels

Good:

- `group_by`
- `where_vs_having_confusion`
- `join_wrong_key`

Avoid:

- long paragraph-like IDs
- changing IDs frequently
- mixing label text with IDs

## Recommended Way To Load These Files

The backend should load one topic pack at a time based on `topic_id`.

Example:

```javascript
const topicId = "sql_query_reasoning";
const base = path.join("knowledge_base", "topics", topicId);
```

Then load:

- `manifest.json`
- `concept_graph.json`
- `misconceptions.json`
- `interventions.json`
- `problems.json`
- `evaluation_rules.json`

That makes topic switching clean.

## Best MVP Approach

For the first version:

- keep each file small
- 5-8 concepts per topic
- 6-10 misconceptions
- 6-10 intervention rules
- 10-15 practice items

That is enough to test the architecture without making authoring too heavy.
