# Project Structure

CogniWeave is structured around a simple flow:

`student input -> shared memory -> specialist agents -> grounded intervention plan`

## Repository Layout

```text
CogniWeave-Personalized-Learning-Intervention-System/
  .env.example
  requirements.txt
  docs/
    project_structure.md
    architecture.md
    agent_flow.md
  backend/
    app/
      main.py
      config.py
      api/
        routes/
          health.py
          orchestrator.py
      schemas/
        student.py
      services/
        knowledge_base.py
        orchestrator_service.py
  agents/
    __init__.py
    base_agent.py
    shared_memory.py
    diagnosis_agent.py
    intervention_agent.py
    planning_agent.py
    evaluation_agent.py
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
      dbms_normalization/
  sample_data/
    student_profile.json
    attempts.json
  evaluation/
    signals.py
    metrics.py
  db/
    schema.sql
  tasks/
    README.md
  frontend/
    README.md
  tests/
    test_orchestrator_flow.py
```

## Suggested Reading Order

For someone new to the project, this order gives the clearest picture of how the system works:

1. `sample_data/`
2. `knowledge_base/`
3. `agents/shared_memory.py`
4. `agents/diagnosis_agent.py`
5. `agents/intervention_agent.py`
6. `agents/planning_agent.py`
7. `agents/evaluation_agent.py`
8. `backend/app/services/orchestrator_service.py`
9. `backend/app/api/routes/orchestrator.py`

That sequence covers the full request flow from input data to final recommendation.

## Folder Notes

### `sample_data/`

Contains small example inputs used to test the pipeline without setting up a database first.

### `knowledge_base/`

Holds the grounded topic packs:

- SQL Query Reasoning
- Operating Systems Synchronization
- DBMS Normalization and Functional Dependencies

Each pack carries its own concept graph, misconception library, intervention rules, problem metadata, and evaluation rules.

### `agents/`

Contains the specialist agents. Each one handles a single stage in the pipeline:

- `diagnosis_agent.py`: find the learning bottleneck
- `intervention_agent.py`: choose the next best intervention
- `planning_agent.py`: fit that intervention into a real schedule
- `evaluation_agent.py`: define how success will be measured and when to replan

### `agents/shared_memory.py`

Defines the shared state passed through the agent pipeline. Each agent reads from it, updates it, and leaves a trace entry behind.

### `backend/app/services/orchestrator_service.py`

Coordinates the agent sequence for a single request:

1. build shared memory
2. run the agents in order
3. return the final result

### `backend/app/api/routes/orchestrator.py`

API entry point for the orchestration flow. The frontend or a local test script sends student data here.

### `evaluation/`

Keeps evaluation logic separate from diagnosis and planning so it can be extended without changing the whole pipeline.

### `db/schema.sql`

Starter schema for the main persistent entities:

- student profile
- concept mastery
- attempts
- intervention history

### `tasks/`

Reserved for background jobs later on. Likely candidates:

- recompute mastery every night
- detect weak concepts after new attempts
- trigger replanning after a bad assessment

### `frontend/`

Reserved for the demo client. The backend, knowledge base, and agent pipeline remain the main focus of the project.
