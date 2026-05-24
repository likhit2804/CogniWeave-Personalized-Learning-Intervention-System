# Architecture

## Core Idea

CogniWeave is a grounded multi-agent learning support system. The pipeline is intentionally narrow:

1. read student signals
2. read domain knowledge
3. create shared memory
4. run specialist agents
5. return a diagnosis, intervention plan, and evaluation plan
The same pipeline is expected to work across different engineering topics. Only the topic pack should change.

*Note: The core pipeline is implemented as a Node.js/Express backend using the `@google/generative-ai` SDK and an asynchronous JavaScript loop, allowing easy deployment and fast startup times.*

## The Four Agents

### Diagnosis Agent

Inputs:

- incorrect attempts
- repeated error tags
- low confidence
- high time-to-solve

Outputs:

- likely concept bottleneck
- likely misconception

### Intervention Agent

Inputs:

- diagnosis result
- misconception library
- intervention library

Outputs:

- best next intervention
- why that intervention fits

### Planning Agent

Inputs:

- available study time
- deadlines
- selected intervention

Outputs:

- short study plan
- day-by-day action steps

### Evaluation Agent

Inputs:

- selected intervention
- concept type
- prior performance pattern

Outputs:

- success signals to watch
- when to re-evaluate
- when to trigger replanning
