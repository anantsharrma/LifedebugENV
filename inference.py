import os
import json
import requests
from openai import OpenAI

# Configuration from environment variables
# 1. The RL Environment Server URL (where server.ts is running)
ENV_URL = os.getenv("ENV_URL", "http://localhost:7860")

# 2. LLM Configuration
# Defaulting to Gemini's OpenAI-compatible endpoint since you're in AI Studio.
# You can also use HF_TOKEN for Hugging Face Inference Endpoints.
LLM_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("HF_TOKEN") or os.getenv("OPENAI_API_KEY")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
MODEL_NAME = os.getenv("MODEL_NAME", "gemini-1.5-flash")

# Initialize OpenAI client (compatible with Gemini and HF)
client = OpenAI(
    api_key=LLM_API_KEY or "dummy_key",
    base_url=LLM_BASE_URL
)


def run_task(task_id):
    print(f'[START] {{"task_id": "{task_id}", "model": "{MODEL_NAME}"}}')
    
    # 1. Reset the environment
    try:
        resp = requests.post(f"{ENV_URL}/internal-api/reset?task_id={task_id}")
        resp.raise_for_status()
        data = resp.json()
        session_id = data["session_id"]
        obs = data["observation"]
    except Exception as e:
        print(f"Error resetting environment at {ENV_URL}: {e}")
        return

    done = False
    step = 0
    total_reward = 0
    
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
            
            # 3. Execute the action
            if action_type == "inspect":
                res = requests.post(f"{ENV_URL}/internal-api/inspect", json={
                    "session_id": session_id, 
                    "variable": action_data.get("variable")
                })
            elif action_type == "test":
                res = requests.post(f"{ENV_URL}/internal-api/test", json={
                    "session_id": session_id, 
                    "variable": action_data.get("variable")
                })
            elif action_type == "diagnose":
                res = requests.post(f"{ENV_URL}/internal-api/diagnose", json={
                    "session_id": session_id, 
                    "causes": action_data.get("causes", [])
                })
            else:
                print(f"Unknown action type: {action_type}")
                break
                
            res.raise_for_status()
            step_res = res.json()
            
            obs = step_res["observation"]
            reward = step_res["reward"]["step_reward"]
            total_reward = step_res["reward"]["value"]
            done = step_res["done"]
            
            # 4. Log the step
            log_data = {
                "step": step,
                "action": action_type,
                "reward": reward,
                "done": done
            }
            print(f'[STEP] {json.dumps(log_data)}')
            
        except Exception as e:
            print(f"Error during step {step}: {e}")
            break
            
    # 5. Log the end of the task
    end_data = {
        "task_id": task_id,
        "score": round(total_reward, 2),
        "steps": step
    }
    print(f'[END] {json.dumps(end_data)}')

if __name__ == "__main__":
    tasks = ["easy_1", "medium_1", "hard_1"]
    for task in tasks:
        run_task(task)
