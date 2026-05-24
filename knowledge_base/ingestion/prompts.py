"""LLM prompt templates for textbook → topic pack extraction."""

# --------------- Pass 1: Concept Extraction ---------------

CONCEPT_EXTRACTION_PROMPT = """\
You are an expert educational content analyst. Given a chapter from a textbook, \
extract the core concepts that a student must learn.

## Instructions
1. Identify 5-8 distinct concepts from the chapter content.
2. For each concept, determine its prerequisites (other concepts it depends on).
3. List related concepts that are connected but not strict prerequisites.
4. Keep concept IDs in snake_case (e.g., "binary_search", "linked_list_traversal").
5. Write clear, concise descriptions (1-2 sentences each).

## Chapter Title
{chapter_title}

## Chapter Content
{chapter_content}

## Required Output Format (JSON)
Return ONLY valid JSON matching this exact structure:
{{
  "topic_id": "{topic_id}",
  "title": "<Human readable topic title>",
  "difficulty": "<beginner|intermediate|advanced>",
  "description": "<1-2 sentence topic description>",
  "concepts": [
    {{
      "id": "<snake_case_id>",
      "label": "<Human Readable Label>",
      "description": "<1-2 sentence description>",
      "prerequisites": ["<concept_id_1>"],
      "related_concepts": ["<concept_id_2>"]
    }}
  ]
}}
"""

# --------------- Pass 2: Misconception Generation ---------------

MISCONCEPTION_GENERATION_PROMPT = """\
You are an expert educational psychologist specializing in student misconceptions. \
Given a list of concepts from a topic, generate the common mistakes students make.

## Instructions
1. For each concept, identify 1-3 common misconceptions students have.
2. Each misconception must have specific, machine-matchable error_tags.
3. Symptoms should be observable from student work (wrong answers, patterns).
4. Keep misconception IDs in snake_case.
5. error_tags should be short, lowercase, underscore-separated identifiers.

## Topic: {topic_title}
## Concepts
{concepts_json}

## Original Chapter Content (for context)
{chapter_content}

## Required Output Format (JSON)
Return ONLY valid JSON matching this exact structure:
{{
  "topic_id": "{topic_id}",
  "items": [
    {{
      "id": "<snake_case_misconception_id>",
      "concept_id": "<matching_concept_id>",
      "label": "<Short label>",
      "error_tags": ["<tag1>", "<tag2>"],
      "symptoms": [
        "<observable symptom 1>",
        "<observable symptom 2>"
      ],
      "notes": "<Why this misconception happens>"
    }}
  ]
}}
"""

# --------------- Pass 3: Intervention Generation ---------------

INTERVENTION_GENERATION_PROMPT = """\
You are an expert learning intervention designer. Given a set of misconceptions \
for a topic, design targeted corrective activities.

## Instructions
1. For each misconception, design 1 intervention rule with 2-3 concrete activities.
2. Activities must be actionable (drills, comparisons, worked examples).
3. Expected signals should describe what improvement looks like.
4. Assign priority 1 (highest) to the most impactful interventions.

## Topic: {topic_title}
## Misconceptions
{misconceptions_json}

## Original Chapter Content (for context)
{chapter_content}

## Required Output Format (JSON)
Return ONLY valid JSON matching this exact structure:
{{
  "topic_id": "{topic_id}",
  "rules": [
    {{
      "id": "<fix_misconception_id>",
      "concept_id": "<concept_id>",
      "misconception_id": "<misconception_id>",
      "strategy": "<Strategy Name>",
      "activities": [
        "<Concrete activity description 1>",
        "<Concrete activity description 2>"
      ],
      "expected_signals": [
        "<Expected improvement signal 1>",
        "<Expected improvement signal 2>"
      ],
      "priority": 1
    }}
  ]
}}
"""

# --------------- Pass 4: Problem Generation ---------------

PROBLEM_GENERATION_PROMPT = """\
You are an expert assessment designer. Given concepts and their misconceptions, \
generate practice problems that test understanding and expose common mistakes.

## Instructions
1. Generate 2-3 problems per concept (10-15 total).
2. Each problem should test specific skills and potentially trigger known error tags.
3. Vary difficulty: mix easy, medium, and hard problems.
4. Problem types can be: calculation, conceptual, debugging, comparison, application.
5. Problem IDs should follow the pattern: <topic_prefix>_<number> (e.g., "ds_001").

## Topic: {topic_title} (prefix: {topic_prefix})
## Concepts
{concepts_json}

## Known Error Tags (from misconceptions)
{error_tags_json}

## Required Output Format (JSON)
Return ONLY valid JSON matching this exact structure:
{{
  "topic_id": "{topic_id}",
  "items": [
    {{
      "id": "<topic_prefix>_001",
      "title": "<Problem title>",
      "concept_ids": ["<concept_id>"],
      "difficulty": "<easy|medium|hard>",
      "problem_type": "<calculation|conceptual|debugging|comparison|application>",
      "skills_tested": ["<skill_1>", "<skill_2>"],
      "expected_error_tags": ["<error_tag_1>"]
    }}
  ]
}}
"""

# --------------- Pass 5: Evaluation Rules Generation ---------------

EVALUATION_RULES_PROMPT = """\
You are an expert in learning assessment design. Given concepts and their \
intervention strategies, define how to measure whether interventions work.

## Instructions
1. For each concept, define 3-4 success signals.
2. Include partial success conditions (improvement but not mastery).
3. Define clear replan triggers (when the intervention needs to be changed).
4. Signals should be measurable from student attempt data.

## Topic: {topic_title}
## Concepts
{concepts_json}

## Interventions
{interventions_json}

## Required Output Format (JSON)
Return ONLY valid JSON matching this exact structure:
{{
  "topic_id": "{topic_id}",
  "rules": [
    {{
      "concept_id": "<concept_id>",
      "success_signals": [
        "<Measurable success signal 1>",
        "<Measurable success signal 2>"
      ],
      "partial_success_conditions": [
        "<Partial improvement condition>"
      ],
      "replan_trigger": [
        "<Condition that requires replanning>"
      ]
    }}
  ]
}}
"""
