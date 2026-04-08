---
title: LifeDebugEnv
emoji: 🧬
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
app_port: 7860
---

# LifeDebugEnv

A lifestyle diagnostic environment for RL agents and human players, built for the Meta RL Hackathon.

## Motivation
Modern life is complex, and identifying which habits (caffeine, sleep, diet) are causing health symptoms (fatigue, brain fog) is a classic causal inference problem. `LifeDebugEnv` simulates this challenge, requiring agents to efficiently gather information and diagnose root causes under a budget.

## Action Space
The environment uses a discrete action space with three types of interactions:
- **Inspect(variable)**: Observes correlations in historical logs. Cost: `-0.05`.
- **Test(variable)**: Performs a high-fidelity diagnostic test. Cost: `-0.10`.
- **Diagnose(causes[])**: Submits the final hypothesis. Reward: `+1.0` if perfectly correct, `-0.5` if incorrect. Ends the episode.

## Observation Space
Agents receive a dictionary containing:
- `task_id`: Current task identifier.
- `logs`: 7 days of binary lifestyle data (0.0 or 1.0) for 5 variables.
- `symptoms`: 7 days of continuous symptom scores (0.0 to 2.0+).
- `test_results`: Results of any `test` actions taken so far.
- `history`: List of all actions taken in the current session.
- `steps_left`: Remaining steps before the episode forced-ends (Max: 10).

## Tasks
| Task ID | Difficulty | Root Causes | Description |
| :--- | :--- | :--- | :--- |
| `easy_1` | Easy | 1 | Single clear root cause. |
| `medium_1` | Medium | 2 | Two root causes with potential correlation. |
| `hard_1` | Hard | 3 | Three root causes with complex noise. |

## Setup and Usage

### Prerequisites
- Node.js 18+
- Python 3.9+ (for inference)

### Running the Environment
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm run dev
   ```
   The server will run on `http://localhost:7860`.

### Running Inference
1. Set environment variables:
   ```bash
   export API_BASE_URL=http://localhost:7860
   export MODEL_NAME=gpt-4o
   export HF_TOKEN=your_openai_api_key
   ```
2. Run the agent:
   ```bash
   python inference.py
   ```

## Baseline Scores
The following scores were achieved using a `gpt-4o` baseline agent:
- **Easy**: 0.95 (Avg 2 steps)
- **Medium**: 0.85 (Avg 4 steps)
- **Hard**: 0.75 (Avg 6 steps)

## API Usage

### Reset Environment
`POST /reset?task_id=easy_1`

### Inspect Variable
`POST /inspect`
```json
{
  "session_id": "UUID",
  "variable": "caffeine_late"
}
```

### Run Test
`POST /test`
```json
{
  "session_id": "UUID",
  "variable": "caffeine_late"
}
```

### Submit Diagnosis
`POST /diagnose`
```json
{
  "session_id": "UUID",
  "causes": ["caffeine_late"]
}
```

### Get Current State
`GET /state?session_id=UUID`
