# Project Structure

CogniWeave is structured around a simple flow:

`student input -> shared memory -> specialist agents -> grounded intervention plan`

## Repository Layout

```text
CogniWeave-Personalized-Learning-Intervention-System/
  .env.example
  docs/
    project_structure.md
    architecture.md
    agent_flow.md
  backend-node/
    package.json
    src/
      server.js
      config.js
      routes/
        health.js
        orchestrator.js
        ingest.js
      schemas/
        student.js
      services/
        knowledgeBase.js
        orchestratorService.js
        llmClient.js
      agents/
        prompts.js
        agentSchemas.js
        diagnosisAgent.js
        interventionAgent.js
        planningAgent.js
        evaluationAgent.js
        criticAgent.js
      ingestion/
        textbookParser.js
        topicExtractor.js
        packBuilder.js
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
  db/
    schema.sql
```

## Suggested Reading Order

For someone new to the project, this order gives the clearest picture of how the system works:

1. `sample_data/`
2. `knowledge_base/`
3. `backend-node/src/schemas/student.js`
4. `backend-node/src/agents/diagnosisAgent.js`
5. `backend-node/src/agents/interventionAgent.js`
6. `backend-node/src/agents/planningAgent.js`
7. `backend-node/src/agents/evaluationAgent.js`
8. `backend-node/src/services/orchestratorService.js`
9. `backend-node/src/routes/orchestrator.js`

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

### `backend-node/src/agents/`

Contains the specialist agents. Each one handles a single stage in the pipeline:

- `diagnosisAgent.js`: find the learning bottleneck
- `interventionAgent.js`: choose the next best intervention
- `planningAgent.js`: fit that intervention into a real schedule
- `evaluationAgent.js`: define how success will be measured and when to replan
- `criticAgent.js`: review the generated plan

### `backend-node/src/services/orchestratorService.js`

Coordinates the agent sequence for a single request:

1. build the state object
2. run the agents in an async loop
3. return the final result

### `backend-node/src/routes/orchestrator.js`

API entry point for the orchestration flow. The frontend or a local test script sends student data here.

### `db/schema.sql`

Starter schema for the main persistent entities:

- student profile
- concept mastery
- attempts
- intervention history
