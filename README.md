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

A lifestyle diagnostic environment for RL agents and human players.

## Features
- **Synthetic Data Generation**: Realistic lifestyle logs with confounders and noise.
- **Diagnostic Tasks**: Multiple difficulty levels (Easy, Medium, Hard).
- **Interactive API**: FastAPI-based backend for seamless integration.
- **Dockerized**: Optimized for Hugging Face Spaces and web deployment.

## API Usage

### Reset Environment
`POST /api/reset?task_id=easy_1`

### Inspect Variable
`POST /api/inspect`
```json
{
  "session_id": "UUID",
  "variable": "caffeine_late"
}
```

### Run Test
`POST /api/test`
```json
{
  "session_id": "UUID",
  "variable": "caffeine_late"
}
```

### Submit Diagnosis
`POST /api/diagnose`
```json
{
  "session_id": "UUID",
  "causes": ["caffeine_late"]
}
```
