import axios from 'axios';

const API_BASE_URL = '';

export const api = {
  reset: async (taskId: string = "easy_1", sessionId?: string) => {
    const url = sessionId 
      ? `${API_BASE_URL}/reset?task_id=${taskId}&session_id=${sessionId}`
      : `${API_BASE_URL}/reset?task_id=${taskId}`;
    const response = await fetch(url, { method: 'POST' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  },
  inspect: async (sessionId: string, variable: string) => {
    const response = await fetch(`${API_BASE_URL}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, variable })
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  },
  test: async (sessionId: string, variable: string) => {
    const response = await fetch(`${API_BASE_URL}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, variable })
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  },
  diagnose: async (sessionId: string, causes: string[]) => {
    const response = await fetch(`${API_BASE_URL}/diagnose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, causes })
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  },
  getTasks: async () => {
    const response = await fetch(`${API_BASE_URL}/tasks`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  }
};
