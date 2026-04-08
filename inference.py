import os
import json
import requests
from typing import List, Optional
from openai import OpenAI

# Configuration from environment variables
# API_BASE_URL is the LLM endpoint
API_BASE_URL = os.getenv("API_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
MODEL_NAME = os.getenv("MODEL_NAME", "gemini-1.5-flash")
HF_TOKEN = os.getenv("HF_TOKEN")

# ENV_URL is the location of the LifeDebugEnv server
ENV_URL = os.getenv("ENV_URL", "http://localhost:7860")

# Optional - if you use from_docker_image():
LOCAL_IMAGE_NAME = os.getenv("LOCAL_IMAGE_NAME")

# Initialize OpenAI client
client = OpenAI(
    api_key=HF_TOKEN or os.getenv("GEMINI_API_KEY") or "dummy_key",
    base_url=API_BASE_URL
)

BENCHMARK = "LifeDebugEnv"

def log_start(task: str, env: str, model: str) -> None:
    print(f"[START] task={task} env={env} model={model}", flush=True)

def log_step(step: int, action: str, reward: float, done: bool, error: Optional[str]) -> None:
    error_val = error if error else "null"
    done_val = str(done).lower()
    print(
        f"[STEP] step={step} action={action} reward={reward:.2f} done={done_val} error={error_val}",
        flush=True,
    )

def log_end(success: bool, steps: int, score: float, rewards: List[float]) -> None:
    rewards_str = ",".join(f"{r:.2f}" for r in rewards)
    print(f"[END] success={str(success).lower()} steps={steps} score={score:.2f} rewards={rewards_str}", flush=True)

def run_task(task_id):
    log_start(task=task_id, env=BENCHMARK, model=MODEL_NAME)
    
    # 1. Reset the environment
    try:
        resp = requests.post(f"{ENV_URL}/reset?task_id={task_id}")
        resp.raise_for_status()
        data = resp.json()
        session_id = data["session_id"]
        obs = data["observation"]
    except Exception as e:
        print(f"[DEBUG] Error resetting environment: {e}")
        log_end(success=False, steps=0, score=0.0, rewards=[])
        return

    done = False
    step = 0
    total_reward = 0
    rewards_history = []
    success = False
    last_error = None
    
    # Variables available in the environment
    VARIABLES = ["caffeine_late", "high_gi_lunch", "low_hydration", "poor_sleep_timing", "high_stress"]

    while not done and step < 10:
        step += 1
        
        # 2. Construct the prompt for the LLM
        prompt = f"""
        You are an RL agent solving a lifestyle diagnostic task.
        Task ID: {obs['task_id']}
        
        7-Day Lifestyle Logs (1.0 means active, 0.0 means inactive):
        {json.dumps(obs['logs'], indent=2)}
        
        7-Day Symptom Scores (Higher means worse symptoms):
        {json.dumps(obs['symptoms'], indent=2)}
        
        Previous Test Results (High values ~0.8+ indicate a root cause):
        {json.dumps(obs['test_results'], indent=2)}
        
        Steps Left: {obs['steps_left']}
        
        Available variables: {', '.join(VARIABLES)}
        
        Your Goal: Identify the root cause(s) of the symptoms.
        
        Actions:
        - inspect(variable): Check correlation (Cost: -0.05)
        - test(variable): Run a diagnostic test for high-confidence signal (Cost: -0.10)
        - diagnose(causes): Submit your final list of root causes (Reward: +1.0 if correct, -0.5 if wrong)
        
        Respond ONLY with a JSON object in this format:
        {{"action": "inspect" | "test" | "diagnose", "variable": "var_name", "causes": ["var1", "var2"]}}
        """
        
        try:
            response = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": "You are a diagnostic RL agent. Respond only in JSON."},
                    {"role": "user", "content": prompt}
                ],
                response_format={ "type": "json_object" }
            )
            
            action_data = json.loads(response.choices[0].message.content)
            action_type = action_data.get("action")
            variable = action_data.get("variable", "none")
            
            # 3. Execute the action
            if action_type == "inspect":
                res = requests.post(f"{ENV_URL}/inspect", json={
                    "session_id": session_id, 
                    "variable": variable
                })
                action_str = f"inspect({variable})"
            elif action_type == "test":
                res = requests.post(f"{ENV_URL}/test", json={
                    "session_id": session_id, 
                    "variable": variable
                })
                action_str = f"test({variable})"
            elif action_type == "diagnose":
                causes = action_data.get("causes", [])
                res = requests.post(f"{ENV_URL}/diagnose", json={
                    "session_id": session_id, 
                    "causes": causes
                })
                action_str = f"diagnose({causes})"
            else:
                last_error = f"Unknown action: {action_type}"
                log_step(step=step, action="none", reward=0.0, done=True, error=last_error)
                break
                
            res.raise_for_status()
            step_res = res.json()
            
            obs = step_res["observation"]
            reward = step_res["reward"]["step_reward"]
            total_reward = step_res["reward"]["value"]
            done = step_res["done"]
            
            rewards_history.append(reward)
            
            # 4. Log the step
            log_step(step=step, action=action_str, reward=reward, done=done, error=None)
            
            if done and reward > 0.5: # diagnose correct reward is 1.0
                success = True
            
        except Exception as e:
            last_error = str(e)
            log_step(step=step, action="error", reward=0.0, done=True, error=last_error)
            break
            
    # 5. Log the end of the task
    # Score is normalized to [0, 1]. Total reward can be negative, so we clamp.
    final_score = max(0.0, min(1.0, total_reward))
    log_end(success=success, steps=step, score=final_score, rewards=rewards_history)

if __name__ == "__main__":
    tasks = ["easy_1", "medium_1", "hard_1"]
    for task in tasks:
        run_task(task)
