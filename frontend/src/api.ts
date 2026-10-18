import type { Action, ClassId, Ledger, Run } from './types';
import type { SeasonReport } from './ui/report';

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch('/api' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new ApiError(typeof data.detail === 'string' ? data.detail : 'Please check your input', response.status);
  return data as T;
}
export const api = {
  create: (class_id: ClassId, seed = 42) => request<Run>('/runs', { class_id, seed }),
  run: (id: string) => request<Run>(`/runs/${encodeURIComponent(id)}`),
  action: (id: string, action: Action) => request<Run>(`/runs/${encodeURIComponent(id)}/actions`, action),
  ledger: (id: string) => request<Ledger>(`/runs/${encodeURIComponent(id)}/ledger`),
  chronicle: (id: string, season: string) =>
    request<{ text: string; source: 'gemini' | 'template' }>(
      `/runs/${encodeURIComponent(id)}/chronicle?season=${encodeURIComponent(season)}`),
  /** The season's report card (whole coin, not hundredths). */
  report: (id: string, season: string) =>
    request<SeasonReport>(`/runs/${encodeURIComponent(id)}/report?season=${encodeURIComponent(season)}`),
  /** Chelo's note on the report: OpenAI, or a hand-written line. */
  reportNote: (id: string, season: string) =>
    request<{ text: string; source: 'openai' | 'template' }>(
      `/runs/${encodeURIComponent(id)}/report/note?season=${encodeURIComponent(season)}`),
};
