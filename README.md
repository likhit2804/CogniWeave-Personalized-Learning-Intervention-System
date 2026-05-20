# CogniWeave

CogniWeave is a grounded multi-agent learning support system aimed at engineering topics. The current scaffold focuses on three starter topic packs:

- SQL Query Reasoning
- Operating Systems Synchronization
- DBMS Normalization and Functional Dependencies

The backend pipeline stays generic, while topic-specific knowledge is stored in separate packs under `knowledge_base/topics/`.

## Current Scope

The repository currently includes:

- a small FastAPI backend
- a shared-memory agent pipeline
- starter documentation for topic-pack design
- a working sample flow using `sql_query_reasoning`

## Repository Highlights

- `agents/`: specialist agents and shared memory
- `backend/`: API routes, schemas, and orchestration
- `knowledge_base/topics/`: topic-specific grounded data
- `docs/`: architecture notes, topic selection, and storage format
- `sample_data/`: example student input for local testing

## Quick Start

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn backend.app.main:app --reload
```

After the server starts, the health route is available at `http://localhost:8000/health`.

## Notes

- The frontend is intentionally lightweight at this stage.
- The current sample data is SQL-based so the full flow can be tested end to end.
- Additional topic packs can be added under `knowledge_base/topics/` without changing the orchestration layer.
