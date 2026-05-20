# Topic Selection

The first version of CogniWeave is meant to stay broad in architecture but narrow in implementation.

That means:

- the agent pipeline stays topic-agnostic
- the early testing is done on a few curated topic packs
- the chosen packs should reflect real engineering-student pain points

For the MVP, the selected packs are:

1. `SQL Query Reasoning`
2. `Operating Systems Synchronization`
3. `DBMS Normalization and Functional Dependencies`

## Why these three were chosen

These three topics were selected because they hit the right balance between:

- relevance to engineering students
- strong concept structure
- repeatable mistake patterns
- measurable improvement
- enough scope for grounded interventions

They are also different enough from each other to test whether the system is genuinely reusable across domains.

### What each pack contributes

- `SQL Query Reasoning`: query logic, debugging, output prediction, structured correctness
- `Operating Systems Synchronization`: systems reasoning, state tracing, concurrency misconceptions
- `DBMS Normalization and Functional Dependencies`: formal reasoning, decomposition steps, rule-based diagnosis

## Why not start broader

Starting with all engineering topics at once would make the system vague and hard to evaluate.

Starting with these three packs makes it easier to:

- author grounded knowledge
- define concept graphs
- define misconception libraries
- test interventions properly
- compare results across domains

## Role in the architecture

These are topic packs, not separate products.

The same core engine should work across all three:

- shared memory
- diagnosis flow
- intervention flow
- planning flow
- evaluation flow

Only the domain knowledge should change.
