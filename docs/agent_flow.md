# Agent Flow

## Request Flow

### Step 1: Student input arrives

The API receives:

- student profile
- attempt history
- prior interventions

### Step 2: Shared memory is created

A `SharedMemory` instance is created for the request. It carries the current student state, the agent outputs, and the trace log.

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
