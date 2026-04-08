import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// --- RL Environment Logic (Translated from Python) ---

enum LifeDebugActionType {
  INSPECT = "inspect",
  TEST = "test",
  DIAGNOSE = "diagnose"
}

interface Action {
  action_type: LifeDebugActionType;
  variable?: string;
  causes?: string[];
  reasoning?: string;
}

interface Task {
  id: string;
  difficulty: string;
  description: string;
  root_causes: string[];
}

const TASKS: Task[] = [
  {
    id: "easy_1",
    difficulty: "easy",
    description: "You feel tired every afternoon. Find the cause.",
    root_causes: ["caffeine_late"]
  },
  {
    id: "medium_1",
    difficulty: "medium",
    description: "You have trouble focusing in the morning. Find the causes.",
    root_causes: ["poor_sleep_timing", "high_stress"]
  },
  {
    id: "hard_1",
    difficulty: "hard",
    description: "Three root causes with complex interactions and confounders.",
    root_causes: ["poor_sleep_timing", "high_stress", "caffeine_late"]
  }
];

const VARIABLES = [
  "caffeine_late",
  "high_stress",
  "high_gi_lunch",
  "low_hydration",
  "poor_sleep_timing"
];

class LifeDebugEnv {
  taskId: string;
  task: Task;
  stepCount: number = 0;
  maxSteps: number = 10;
  actionsTaken: Action[] = [];
  isDone: boolean = false;
  testResults: Record<string, number> = {};
  logs: Record<string, number>[] = [];
  symptoms: number[] = [];
  totalReward: number = 0;

  constructor(taskId: string = "easy_1") {
    this.taskId = taskId;
    const foundTask = TASKS.find(t => t.id === taskId);
    if (!foundTask) throw new Error(`Task ${taskId} not found`);
    this.task = foundTask;
    this.reset();
  }

  reset() {
    this.stepCount = 0;
    this.actionsTaken = [];
    this.isDone = false;
    this.testResults = {};
    this.totalReward = 0;
    
    // Generate synthetic logs
    this.logs = [];
    this.symptoms = [];
    for (let i = 0; i < 7; i++) {
      const dayData: Record<string, number> = {};
      dayData["caffeine_late"] = Math.random() < 0.4 ? 1.0 : 0.0;
      dayData["high_stress"] = dayData["caffeine_late"] === 1.0 
        ? (Math.random() < 0.7 ? 1.0 : 0.0)
        : (Math.random() < 0.2 ? 1.0 : 0.0);
      dayData["high_gi_lunch"] = Math.random() < 0.3 ? 1.0 : 0.0;
      dayData["low_hydration"] = Math.random() < 0.5 ? 1.0 : 0.0;
      dayData["poor_sleep_timing"] = Math.random() < 0.3 ? 1.0 : 0.0;
      
      let score = 0;
      for (const varName of this.task.root_causes) {
        score += dayData[varName] || 0;
      }
      const noisyScore = Math.max(0.0, score + (Math.random() * 0.4 - 0.2));
      
      this.logs.push(dayData);
      this.symptoms.push(noisyScore);
    }

    return this.getObs();
  }

  getObs() {
    return {
      task_id: this.task.id,
      logs: this.logs,
      symptoms: this.symptoms,
      test_results: this.testResults,
      history: this.actionsTaken,
      steps_left: this.maxSteps - this.stepCount
    };
  }

  step(action: Action) {
    if (this.isDone) throw new Error("Episode is already finished.");

    this.stepCount++;
    this.actionsTaken.push(action);
    
    let stepReward = 0;
    let reason = "In progress";

    if (action.action_type === LifeDebugActionType.INSPECT) {
      stepReward = -0.05;
      reason = `Inspected ${action.variable}. Information cost applied.`;
    } else if (action.action_type === LifeDebugActionType.TEST && action.variable) {
      stepReward = -0.10;
      reason = `Performed diagnostic test on ${action.variable}. Test cost applied.`;
      if (this.task.root_causes.includes(action.variable)) {
        this.testResults[action.variable] = 0.6 + Math.random() * 0.4;
      } else {
        this.testResults[action.variable] = Math.random() * 0.3 - 0.1;
      }
    }
    
    if (action.action_type === LifeDebugActionType.DIAGNOSE && action.causes) {
      this.isDone = true;
      const correct = this.task.root_causes.every(c => action.causes?.includes(c)) && 
                      action.causes.every(c => this.task.root_causes.includes(c));
      if (correct) {
        stepReward += 1.0;
        reason = "Correct diagnosis! Major reward granted.";
      } else {
        stepReward -= 0.5;
        reason = `Incorrect diagnosis. Penalty applied. The root causes were: ${this.task.root_causes.join(", ")}`;
      }
    } else if (this.stepCount >= this.maxSteps) {
      this.isDone = true;
      stepReward -= 0.2;
      reason = "Max steps reached without diagnosis. Efficiency penalty applied.";
    }

    this.totalReward += stepReward;
    
    const reward = {
      value: this.totalReward,
      step_reward: stepReward,
      reason: reason,
      done: this.isDone
    };
    
    const info = {
      step_count: this.stepCount,
      max_steps: this.maxSteps,
      task_difficulty: this.task.difficulty,
      root_causes: this.task.root_causes
    };
    
    return { observation: this.getObs(), reward, done: this.isDone, info };
  }
}

// --- API Routes ---

interface SessionData {
  env: LifeDebugEnv;
  lastActive: number;
}

const sessions: Record<string, SessionData> = {};

// Prune sessions older than 24 hours every hour
setInterval(() => {
  const now = Date.now();
  const expiry = 24 * 60 * 60 * 1000;
  for (const [id, data] of Object.entries(sessions)) {
    if (now - data.lastActive > expiry) {
      console.log(`DEBUG: Pruning session ${id}`);
      delete sessions[id];
    }
  }
}, 60 * 60 * 1000);

app.post('/internal-api/reset', (req, res) => {
  console.log(`DEBUG: Reset request: task_id=${req.query.task_id}, session_id=${req.query.session_id}`);
  const taskId = req.query.task_id as string || "easy_1";
  let sessionId = req.query.session_id as string;
  
  if (!sessionId) {
    sessionId = uuidv4();
  }
  
  try {
    const env = new LifeDebugEnv(taskId);
    sessions[sessionId] = { env, lastActive: Date.now() };
    const obs = env.reset();
    console.log(`DEBUG: Reset successful for session ${sessionId}`);
    res.json({ session_id: sessionId, observation: obs });
  } catch (error: any) {
    console.error(`ERROR: Reset failed: ${error.message}`);
    res.status(400).json({ detail: error.message });
  }
});

app.post('/internal-api/inspect', (req, res) => {
  const { session_id, variable } = req.body;
  const session = sessions[session_id];
  if (!session) return res.status(404).json({ detail: "Session not found" });
  
  session.lastActive = Date.now();
  try {
    const result = session.env.step({ action_type: LifeDebugActionType.INSPECT, variable });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ detail: error.message });
  }
});

app.post('/internal-api/test', (req, res) => {
  const { session_id, variable } = req.body;
  const session = sessions[session_id];
  if (!session) return res.status(404).json({ detail: "Session not found" });
  
  session.lastActive = Date.now();
  try {
    const result = session.env.step({ action_type: LifeDebugActionType.TEST, variable });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ detail: error.message });
  }
});

app.post('/internal-api/diagnose', (req, res) => {
  const { session_id, causes } = req.body;
  const session = sessions[session_id];
  if (!session) return res.status(404).json({ detail: "Session not found" });
  
  session.lastActive = Date.now();
  try {
    const result = session.env.step({ action_type: LifeDebugActionType.DIAGNOSE, causes });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ detail: error.message });
  }
});

app.get('/internal-api/state', (req, res) => {
  const sessionId = req.query.session_id as string;
  const session = sessions[sessionId];
  if (!session) return res.status(404).json({ detail: "Session not found" });
  
  session.lastActive = Date.now();
  res.json({ observation: session.env.getObs() });
});

app.get('/internal-api/tasks', (req, res) => {
  res.json(TASKS.map(t => ({ id: t.id, difficulty: t.difficulty, description: t.description })));
});

app.get('/internal-api/health', (req, res) => {
  res.json({ status: "ok", message: "Node backend is healthy" });
});

// --- Vite Integration ---

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    console.log('DEBUG: Starting Vite in middleware mode...');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('DEBUG: Serving static files from dist/');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();
