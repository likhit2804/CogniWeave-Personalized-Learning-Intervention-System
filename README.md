# CogniWeave

CogniWeave is a grounded multi-agent learning support system aimed at engineering topics. The current scaffold focuses on three starter topic packs:

- SQL Query Reasoning
- Operating Systems Synchronization
- DBMS Normalization and Functional Dependencies

The backend pipeline stays generic, while topic-specific knowledge is stored in separate packs under `knowledge_base/topics/`.

## Current Scope

The repository currently includes:

- a Node.js/Express backend
- a plain-JS async loop agent pipeline
- starter documentation for topic-pack design
- a working sample flow using `sql_query_reasoning`

## Repository Highlights

- `backend-node/src/agents/`: specialist agents and shared memory state
- `backend-node/src/`: API routes, schemas, and orchestration
- `knowledge_base/topics/`: topic-specific grounded data
- `docs/`: architecture notes, topic selection, storage format, and the step guide to building new knowledge bases
- `sample_data/`: example student input for local testing

## Quick Start

```bash
cd backend-node
npm install
npm run dev
```

After the server starts, the health route is available at `http://localhost:8000/health`.

## Notes

- The frontend is intentionally lightweight at this stage.
- The current sample data is SQL-based so the full flow can be tested end to end.
- Additional topic packs can be added under `knowledge_base/topics/` without changing the orchestration layer.
