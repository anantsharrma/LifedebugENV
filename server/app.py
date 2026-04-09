import os
import random
import time
import uuid
from typing import List, Optional, Dict, Any
from enum import Enum
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI()

# --- RL Environment Logic ---

class LifeDebugActionType(str, Enum):
    INSPECT = "inspect"
    TEST = "test"
    DIAGNOSE = "diagnose"

class Action(BaseModel):
    action_type: LifeDebugActionType
    variable: Optional[str] = None
    causes: Optional[List[str]] = None
    reasoning: Optional[str] = None

class Task(BaseModel):
    id: str
    difficulty: str
    description: str
    root_causes: List[str]

TASKS = [
    Task(
        id="easy_1",
        difficulty="easy",
        description="You feel tired every afternoon. Find the cause.",
        root_causes=["caffeine_late"]
    ),
    Task(
        id="medium_1",
        difficulty="medium",
        description="You have trouble focusing in the morning. Find the causes.",
        root_causes=["poor_sleep_timing", "high_stress"]
    ),
    Task(
        id="hard_1",
        difficulty="hard",
        description="Three root causes with complex interactions and confounders.",
        root_causes=["poor_sleep_timing", "high_stress", "caffeine_late"]
    )
]

VARIABLES = [
    "caffeine_late",
    "high_stress",
    "high_gi_lunch",
    "low_hydration",
    "poor_sleep_timing"
]

class LifeDebugEnv:
    def __init__(self, task_id: str = "easy_1"):
        self.task_id = task_id
        self.task = next((t for t in TASKS if t.id == task_id), None)
        if not self.task:
            raise ValueError(f"Task {task_id} not found")
        
        self.max_steps = 10
        self.reset()

    def reset(self):
        self.step_count = 0
        self.actions_taken = []
        self.is_done = False
        self.test_results = {}
        self.total_reward = 0
        
        # Generate synthetic logs
        self.logs = []
        self.symptoms = []
        for _ in range(7):
            day_data = {}
            day_data["caffeine_late"] = 1.0 if random.random() < 0.4 else 0.0
            day_data["high_stress"] = (
                1.0 if random.random() < 0.7 else 0.0
            ) if day_data["caffeine_late"] == 1.0 else (
                1.0 if random.random() < 0.2 else 0.0
            )
            day_data["high_gi_lunch"] = 1.0 if random.random() < 0.3 else 0.0
            day_data["low_hydration"] = 1.0 if random.random() < 0.5 else 0.0
            day_data["poor_sleep_timing"] = 1.0 if random.random() < 0.3 else 0.0
            
            score = sum(day_data.get(rc, 0) for rc in self.task.root_causes)
            noisy_score = max(0.0, score + (random.random() * 0.4 - 0.2))
            
            self.logs.append(day_data)
            self.symptoms.append(noisy_score)

        return self.get_obs()

    def get_obs(self):
        return {
            "task_id": self.task.id,
            "logs": self.logs,
            "symptoms": self.symptoms,
            "test_results": self.test_results,
            "history": [a.dict() for a in self.actions_taken],
            "steps_left": self.max_steps - self.step_count
        }

    def step(self, action: Action):
        if self.is_done:
            raise ValueError("Episode is already finished.")

        self.step_count += 1
        self.actions_taken.append(action)
        
        step_reward = 0.0
        reason = "In progress"

        if action.action_type == LifeDebugActionType.INSPECT:
            step_reward = -0.05
            reason = f"Inspected {action.variable}. Information cost applied."
        elif action.action_type == LifeDebugActionType.TEST and action.variable:
            step_reward = -0.10
            reason = f"Performed diagnostic test on {action.variable}. Test cost applied."
            if action.variable in self.task.root_causes:
                self.test_results[action.variable] = 0.6 + random.random() * 0.4
            else:
                self.test_results[action.variable] = random.random() * 0.3 - 0.1
        
        if action.action_type == LifeDebugActionType.DIAGNOSE and action.causes:
            self.is_done = True
            correct = set(self.task.root_causes) == set(action.causes)
            if correct:
                step_reward += 1.0
                reason = "Correct diagnosis! Major reward granted."
            else:
                step_reward -= 0.5
                reason = f"Incorrect diagnosis. Penalty applied. The root causes were: {', '.join(self.task.root_causes)}"
        elif self.step_count >= self.max_steps:
            self.is_done = True
            step_reward -= 0.2
            reason = "Max steps reached without diagnosis. Efficiency penalty applied."

        self.total_reward += step_reward
        
        reward_info = {
            "value": round(self.total_reward, 2),
            "step_reward": round(step_reward, 2),
            "reason": reason,
            "done": self.is_done
        }
        
        info = {
            "step_count": self.step_count,
            "max_steps": self.max_steps,
            "task_difficulty": self.task.difficulty,
            "root_causes": self.task.root_causes
        }
        
        return {"observation": self.get_obs(), "reward": reward_info, "done": self.is_done, "info": info}

# --- API Routes ---

sessions: Dict[str, Dict[str, Any]] = {}

@app.post("/reset")
async def reset(task_id: str = "easy_1", session_id: Optional[str] = None):
    if not session_id:
        session_id = str(uuid.uuid4())
    
    try:
        env = LifeDebugEnv(task_id)
        sessions[session_id] = {"env": env, "last_active": time.time()}
        obs = env.reset()
        return {"session_id": session_id, "observation": obs}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/inspect")
async def inspect(req: Request):
    data = await req.json()
    session_id = data.get("session_id")
    variable = data.get("variable")
    
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session["last_active"] = time.time()
    try:
        action = Action(action_type=LifeDebugActionType.INSPECT, variable=variable)
        return session["env"].step(action)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/test")
async def run_test(req: Request):
    data = await req.json()
    session_id = data.get("session_id")
    variable = data.get("variable")
    
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session["last_active"] = time.time()
    try:
        action = Action(action_type=LifeDebugActionType.TEST, variable=variable)
        return session["env"].step(action)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/diagnose")
async def diagnose(req: Request):
    data = await req.json()
    session_id = data.get("session_id")
    causes = data.get("causes")
    
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session["last_active"] = time.time()
    try:
        action = Action(action_type=LifeDebugActionType.DIAGNOSE, causes=causes)
        return session["env"].step(action)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/state")
async def get_state(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session["last_active"] = time.time()
    return {"observation": session["env"].get_obs()}

@app.get("/tasks")
async def get_tasks():
    return [{"id": t.id, "difficulty": t.difficulty, "description": t.description} for t in TASKS]

@app.get("/health")
async def health():
    return {"status": "ok", "message": "Python backend is healthy"}

# --- Static Files & SPA Fallback ---

# In production, serve the React frontend
if os.path.exists("dist"):
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # If it's an API route, let FastAPI handle it
        if full_path.startswith("api/") or full_path in ["reset", "inspect", "test", "diagnose", "state", "tasks", "health"]:
            raise HTTPException(status_code=404)
        
        # Otherwise serve index.html for SPA routing
        index_path = os.path.join("dist", "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return JSONResponse({"detail": "Not Found"}, status_code=404)

def main():
    import uvicorn
    port = int(os.getenv("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port)

if __name__ == "__main__":
    main()
