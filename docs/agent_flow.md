# Agent Flow

## Request Flow

### Step 1: Student input arrives

The API receives:

- student profile
- attempt history
- prior interventions

### Step 2: State object is created

A `state` object is created for the request. It carries the current student state, the agent outputs, and the trace log through the pipeline.

### Step 3: Diagnosis Agent runs

It identifies:

- the weakest concept
- the top misconception
- evidence for that diagnosis

### Step 4: Intervention Agent runs

It chooses:

- the best intervention type
- matching activities
- reason for choosing them

### Step 5: Planning Agent runs

It builds:

- a short study schedule
- a realistic set of actions

### Step 5.5: Critic Agent runs (Loop)

It reviews the plan and checks if:

- there are enough sessions
- the schedule is well distributed
- the plan addresses the intervention

If the plan fails the review, the flow loops back to the Planning Agent with feedback.

### Step 6: Evaluation Agent runs

It defines:

- what success looks like
- what signals to check
- when to replan

### Step 7: Final response is returned

The API returns:

- diagnosis
- intervention
- plan
- evaluation criteria
- trace log
