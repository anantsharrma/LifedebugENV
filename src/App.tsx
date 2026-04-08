/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Search, 
  TestTube, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  Play, 
  FileCode, 
  ChevronRight,
  Info,
  History,
  Terminal as TerminalIcon,
  Stethoscope,
  LayoutDashboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from './services/api';

// --- Constants & Types ---

const VARIABLES = [
  "caffeine_late",
  "high_gi_lunch",
  "low_hydration",
  "poor_sleep_timing",
  "high_stress"
];

const VAR_LABELS: Record<string, string> = {
  "caffeine_late": "Late Caffeine",
  "high_gi_lunch": "High GI Lunch",
  "low_hydration": "Low Hydration",
  "poor_sleep_timing": "Poor Sleep Timing",
  "high_stress": "High Stress"
};

const TASKS = [
    {
        id: "easy_1",
        root_causes: ["caffeine_late"],
        difficulty: "easy",
        description: "Single obvious root cause: Late caffeine intake."
    },
    {
        id: "medium_1",
        root_causes: ["high_gi_lunch", "low_hydration"],
        difficulty: "medium",
        description: "Two root causes: High GI lunch and dehydration."
    },
    {
        id: "hard_1",
        root_causes: ["poor_sleep_timing", "high_stress", "caffeine_late"],
        difficulty: "hard",
        description: "Three root causes with complex interactions and confounders."
    }
];

interface Action {
  action_type: "inspect" | "test" | "diagnose";
  variable?: string;
  causes?: string[];
  reasoning?: string;
}

interface EpisodeState {
  sessionId: string;
  taskId: string;
  logs: Record<string, number>[];
  symptoms: number[];
  testResults: Record<string, number>;
  history: Action[];
  stepCount: number;
  maxSteps: number;
  done: boolean;
  totalReward: number;
  lastRewardReason: string;
}

// --- Components ---

const CausalGraph = ({ rootCauses, variables }: { rootCauses: string[], variables: string[] }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
    <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
      <Activity size={16} className="text-indigo-500" />
      Causal Relationship Map
    </h3>
    <div className="relative h-48 flex items-center justify-center">
      <svg className="w-full h-full">
        {variables.map((v, i) => {
          const x = 50 + ((i - (variables.length - 1) / 2) * 15);
          const isRoot = rootCauses.includes(v);
          return (
            <g key={v}>
              <motion.line 
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                x1={`${x}%`} y1="20%" x2="50%" y2="80%" 
                stroke={isRoot ? "#6366f1" : "#e2e8f0"} 
                strokeWidth={isRoot ? "2" : "1"}
                strokeDasharray={isRoot ? "none" : "4 2"}
              />
              <circle cx={`${x}%`} cy="20%" r="4" fill={isRoot ? "#6366f1" : "#cbd5e1"} />
            </g>
          );
        })}
        <circle cx="50%" cy="80%" r="8" fill="#f43f5e" />
      </svg>
      <div className="absolute top-0 left-0 w-full flex justify-between px-4">
        {variables.map(v => (
          <div key={v} className="text-[10px] font-bold text-slate-400 rotate-45 origin-left whitespace-nowrap">
            {VAR_LABELS[v]}
          </div>
        ))}
      </div>
      <div className="absolute bottom-0 text-[10px] font-bold text-rose-500 uppercase tracking-widest">
        Symptoms
      </div>
    </div>
    <div className="mt-4 flex items-center gap-4 text-[10px] font-medium text-slate-400">
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-indigo-500" />
        Active Root Cause
      </div>
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-slate-300" />
        Inactive Variable
      </div>
    </div>
  </div>
);

const LogTable = ({ logs, symptoms }: { logs: Record<string, number>[], symptoms: number[] }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
    <table className="w-full text-left text-sm border-collapse">
      <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
        <tr>
          <th className="px-4 py-3 border-b border-slate-100">Day</th>
          {VARIABLES.map(v => <th key={v} className="px-4 py-3 border-b border-slate-100">{VAR_LABELS[v]}</th>)}
          <th className="px-4 py-3 border-b border-slate-100 text-rose-600">Symptom Intensity</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {logs.map((day, i) => (
          <tr key={i} className="hover:bg-slate-50 transition-colors group">
            <td className="px-4 py-3 font-mono font-bold text-slate-300 group-hover:text-indigo-400">D{i+1}</td>
            {VARIABLES.map(v => (
              <td key={v} className="px-2 py-1">
                <div 
                  className={`h-8 w-full rounded-md transition-all duration-500 ${day[v] ? 'bg-indigo-500 shadow-inner' : 'bg-slate-50'}`}
                  title={`${VAR_LABELS[v]}: ${day[v] ? 'Active' : 'Inactive'}`}
                />
              </td>
            ))}
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(symptoms[i] / 3) * 100}%` }}
                    className="h-full bg-rose-500"
                  />
                </div>
                <span className="font-mono font-bold text-rose-500 text-xs w-8">
                  {symptoms[i].toFixed(1)}
                </span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function App() {
  const [state, setState] = useState<EpisodeState | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState(TASKS[0].id);
  const [selectedVar, setSelectedVar] = useState(VARIABLES[0]);
  const [diagnosis, setDiagnosis] = useState<string[]>([]);
  const [hypotheses, setHypotheses] = useState<string[]>([]);
  const [showSpec, setShowSpec] = useState(false);
  const [loading, setLoading] = useState(false);

  const resetEpisode = async (taskId: string) => {
    setLoading(true);
    try {
      const data = await api.reset(taskId, state?.sessionId);
      const obs = data.observation;
      
      setState({
        sessionId: data.session_id,
        taskId: obs.task_id,
        logs: obs.logs,
        symptoms: obs.symptoms,
        testResults: obs.test_results,
        history: obs.history,
        stepCount: 0,
        maxSteps: 10,
        done: false,
        totalReward: 0,
        lastRewardReason: "Environment initialized. Start your investigation."
      });
      setDiagnosis([]);
      setHypotheses([]);
    } catch (error) {
      console.error("Failed to reset episode:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    resetEpisode(selectedTaskId);
  }, []);

  const handleAction = async (action: Action) => {
    if (!state || state.done || loading) return;

    setLoading(true);
    try {
      let result;
      if (action.action_type === 'inspect' && action.variable) {
        result = await api.inspect(state.sessionId, action.variable);
      } else if (action.action_type === 'test' && action.variable) {
        result = await api.test(state.sessionId, action.variable);
      } else if (action.action_type === 'diagnose' && action.causes) {
        result = await api.diagnose(state.sessionId, action.causes);
      }

      if (result) {
        const obs = result.observation;
        const reward = result.reward;
        
        setState({
          ...state,
          logs: obs.logs,
          symptoms: obs.symptoms,
          testResults: obs.test_results,
          history: obs.history,
          stepCount: state.stepCount + 1,
          done: result.done,
          totalReward: reward.value,
          lastRewardReason: reward.reason
        });
      }
    } catch (error) {
      console.error("Action failed:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!state) return null;

  const currentTask = TASKS.find(t => t.id === state.taskId)!;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 font-sans selection:bg-indigo-100">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-indigo-600">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200">
                <Stethoscope size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">LifeDebug<span className="text-slate-400">Env</span></h1>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                  <Activity size={12} />
                  Causal Diagnostic Engine
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
              {TASKS.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTaskId(t.id); resetEpisode(t.id); }}
                  className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${selectedTaskId === t.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {t.difficulty.toUpperCase()}
                </button>
              ))}
            </div>
            <button 
              onClick={async () => {
                try {
                  const res = await api.getTasks();
                  alert("Health Check OK: " + JSON.stringify(res));
                } catch (e: any) {
                  alert("Health Check Failed: " + e.message + (e.response ? " (Status: " + e.response.status + ")" : ""));
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-200"
            >
              <CheckCircle2 size={16} />
              Health Check
            </button>
            <button 
              onClick={() => setShowSpec(!showSpec)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
            >
              <FileCode size={16} />
              {showSpec ? "Hide Spec" : "OpenEnv Spec"}
            </button>
          </div>
        </header>

        {showSpec ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 rounded-3xl p-8 text-slate-300 font-mono text-sm overflow-hidden relative shadow-2xl"
          >
            <div className="absolute top-6 right-8 flex gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
            </div>
            <h3 className="text-indigo-400 mb-6 flex items-center gap-2 text-lg font-bold">
              <TerminalIcon size={20} />
              openenv.yaml
            </h3>
            <pre className="overflow-x-auto scrollbar-hide leading-relaxed">
{`name: LifeDebugEnv
version: 1.0.0
description: Diagnostic environment for lifestyle root causes.
tasks:
  - id: easy_1
    root_causes: ["caffeine_late"]
  - id: medium_1
    root_causes: ["high_gi_lunch", "low_hydration"]
  - id: hard_1
    root_causes: ["poor_sleep_timing", "high_stress", "caffeine_late"]
action_space:
  type: structured
  actions:
    - inspect: { variable: string }
    - test: { variable: string }
    - diagnose: { causes: string[] }
reward_range: [0.0, 1.0]`}
            </pre>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Data & Visualization (8 cols) */}
            <div className="lg:col-span-8 space-y-8">
              
              {/* Top Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Steps Remaining", value: state.maxSteps - state.stepCount, icon: RotateCcw, color: "text-indigo-600" },
                  { label: "Current Reward", value: state.totalReward.toFixed(2), icon: Activity, color: "text-emerald-500" },
                  { label: "Task Complexity", value: currentTask.difficulty.toUpperCase(), icon: Info, color: "text-amber-500" },
                  { label: "System Status", value: state.done ? "IDLE" : "ACTIVE", icon: CheckCircle2, color: state.done ? "text-slate-400" : "text-indigo-500" }
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase font-black mb-2">
                      <stat.icon size={12} className={stat.color} />
                      {stat.label}
                    </div>
                    <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Visualization Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider flex items-center gap-2 px-1">
                    <LayoutDashboard size={16} className="text-indigo-500" />
                    Lifestyle Heatmap
                  </h3>
                  <LogTable logs={state.logs} symptoms={state.symptoms} />
                </div>
                <div className="space-y-4">
                  <CausalGraph rootCauses={state.done ? currentTask.root_causes : []} variables={VARIABLES} />
                </div>
              </div>

              {/* Action Panel */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-xl flex items-center gap-3">
                    <Search size={24} className="text-indigo-500" />
                    Diagnostic Workbench
                  </h3>
                  <div className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                    Step {state.stepCount + 1} of {state.maxSteps}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">1. Variable Analysis</label>
                      <div className="space-y-3">
                        {VARIABLES.map(v => (
                          <div key={v} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 group hover:bg-white hover:border-indigo-200 transition-all">
                            <button 
                              onClick={() => {
                                if (hypotheses.includes(v)) setHypotheses(hypotheses.filter(h => h !== v));
                                else setHypotheses([...hypotheses, v]);
                              }}
                              className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center
                                ${hypotheses.includes(v) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200'}`}
                            >
                              {hypotheses.includes(v) && <CheckCircle2 size={12} />}
                            </button>
                            <span className="flex-1 text-sm font-bold text-slate-600">{VAR_LABELS[v]}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleAction({ action_type: 'inspect', variable: v })}
                                disabled={state.done}
                                className="p-2 bg-white text-indigo-600 rounded-lg border border-slate-200 hover:border-indigo-600 transition-all"
                                title="Inspect Correlation"
                              >
                                <Search size={14} />
                              </button>
                              <button 
                                onClick={() => handleAction({ action_type: 'test', variable: v })}
                                disabled={state.done}
                                className="p-2 bg-white text-amber-600 rounded-lg border border-slate-200 hover:border-amber-600 transition-all"
                                title="Run Diagnostic Test"
                              >
                                <TestTube size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2. Final Diagnosis</label>
                      <div className="p-6 rounded-3xl bg-indigo-50 border border-indigo-100 space-y-6">
                        <div className="flex flex-wrap gap-2">
                          {VARIABLES.map(v => (
                            <button
                              key={v}
                              onClick={() => {
                                if (diagnosis.includes(v)) setDiagnosis(diagnosis.filter(d => d !== v));
                                else setDiagnosis([...diagnosis, v]);
                              }}
                              disabled={state.done}
                              className={`px-4 py-2 rounded-xl text-xs font-black transition-all border-2
                                ${diagnosis.includes(v) 
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' 
                                : 'bg-white border-white text-slate-400 hover:border-indigo-200'
                                }`}
                            >
                              {VAR_LABELS[v]}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => handleAction({ action_type: 'diagnose', causes: diagnosis })}
                          disabled={state.done || diagnosis.length === 0}
                          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-200"
                        >
                          <CheckCircle2 size={20} />
                          Submit Final Diagnosis
                        </button>
                        <p className="text-[10px] text-indigo-400 font-bold text-center italic">
                          Submitting a diagnosis will end the current episode.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Intelligence & Feedback (4 cols) */}
            <div className="lg:col-span-4 space-y-8">
              
              {/* Test Intelligence */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="font-black text-lg mb-6 flex items-center gap-3">
                  <TestTube size={20} className="text-amber-500" />
                  Test Intelligence
                </h3>
                <div className="space-y-5">
                  {VARIABLES.map(v => (
                    <div key={v} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">{VAR_LABELS[v]}</span>
                        {state.testResults[v] !== undefined ? (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${state.testResults[v]! > 0.4 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            {state.testResults[v]! > 0.4 ? 'HIGH CORRELATION' : 'LOW SIGNAL'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-300 italic">Pending...</span>
                        )}
                      </div>
                      <div className="h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                        {state.testResults[v] !== undefined && (
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(5, Math.min(100, (state.testResults[v]! + 0.1) * 90))}%` }}
                            className={`h-full rounded-full ${state.testResults[v]! > 0.4 ? 'bg-emerald-500' : 'bg-slate-300'}`}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reward Feedback */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Activity size={80} />
                </div>
                <h3 className="font-black text-lg mb-6 flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                  Reward Signal
                </h3>
                <div className="space-y-6">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Reward</div>
                      <div className="text-4xl font-black text-indigo-600">{state.totalReward.toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Efficiency</div>
                      <div className="text-lg font-bold text-slate-700">{Math.round((1 - state.stepCount/state.maxSteps) * 100)}%</div>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${state.totalReward * 100}%` }}
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-1000"
                    />
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-500 leading-relaxed font-medium italic">
                    "{state.lastRewardReason}"
                  </div>
                </div>
              </div>

              {/* Diagnostic Assistant (New) */}
              <div className="bg-indigo-600 p-8 rounded-3xl text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
                <div className="absolute -bottom-4 -right-4 opacity-10">
                  <Info size={120} />
                </div>
                <h3 className="font-black text-lg mb-4 flex items-center gap-3">
                  <Play size={20} className="text-indigo-200" />
                  Diagnostic Assistant
                </h3>
                <div className="space-y-4 text-sm font-medium text-indigo-100 leading-relaxed">
                  {state.stepCount === 0 ? (
                    <p>Welcome, Agent. Start by <span className="text-white font-bold underline">inspecting</span> variables in the workbench to see how they correlate with symptoms.</p>
                  ) : state.totalReward < 0.2 ? (
                    <p>Low signal detected. Try running a <span className="text-white font-bold underline">diagnostic test</span> on variables with high activity in the heatmap.</p>
                  ) : (
                    <p>Good progress. You've identified some signals. Refine your <span className="text-white font-bold underline">hypotheses</span> before submitting a final diagnosis.</p>
                  )}
                </div>
              </div>

              {/* Action History */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex-1">
                <h3 className="font-black text-lg mb-6 flex items-center gap-3">
                  <History size={20} className="text-indigo-500" />
                  Event Log
                </h3>
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-4 scrollbar-hide">
                  <AnimatePresence initial={false}>
                    {state.history.map((h, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-black uppercase text-[10px] text-slate-400">Step {i+1}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full 
                            ${h.action_type === 'inspect' ? 'bg-indigo-100 text-indigo-600' : 
                              h.action_type === 'test' ? 'bg-amber-100 text-amber-600' : 
                              'bg-slate-900 text-white'}`}>
                            {h.action_type.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-slate-700 font-bold">
                          {h.action_type === 'inspect' && `Inspected ${VAR_LABELS[h.variable!]}`}
                          {h.action_type === 'test' && `Tested ${VAR_LABELS[h.variable!]}`}
                          {h.action_type === 'diagnose' && `Diagnosis: ${h.causes?.map(c => VAR_LABELS[c]).join(", ")}`}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {state.history.length === 0 && (
                    <div className="text-center py-12 text-slate-300 text-sm italic font-medium">
                      Awaiting initial diagnostic action...
                    </div>
                  )}
                </div>
              </div>

              {/* Final Result Overlay */}
              {state.done && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="bg-slate-900 p-8 rounded-3xl text-white shadow-2xl border-4 border-emerald-500/20"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-emerald-500 text-white rounded-2xl">
                      <CheckCircle2 size={32} />
                    </div>
                    <div>
                      <h3 className="font-black text-xl">Episode Complete</h3>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Diagnostic Report Ready</p>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-400 text-xs font-bold uppercase">Final Agent Score</span>
                        <span className="text-3xl font-black text-emerald-400">{state.totalReward.toFixed(2)}</span>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${state.totalReward * 100}%` }} />
                      </div>
                    </div>
                    <button 
                      onClick={() => resetEpisode(state.taskId)}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={20} />
                      Initialize New Episode
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
