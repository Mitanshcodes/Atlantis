import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';
import type { Action, ClassId, Ledger, Run } from './types';

export type ActionInput = Omit<Action, 'action_id' | 'expected_version'>;
type Pending = { run_id: string; action: Action };
const LAST_RUN = 'atlantis.p2.run';
const PENDING = 'atlantis.p2.pending';
/** A fresh seed per journey; ``?seed=123`` pins one (the judge-mode demo run). */
function journeySeed(): number {
  const pinned = Number(new URLSearchParams(window.location.search).get('seed'));
  return Number.isSafeInteger(pinned) && pinned > 0 ? pinned : Math.floor(Math.random() * 2 ** 31);
}
function readPending(): Pending | null {
  try { return JSON.parse(localStorage.getItem(PENDING) || 'null'); } catch { return null; }
}
export function useBanking() {
  const [run, setRun] = useState<Run | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending | null>(readPending);
  const locked = useRef(false);
  const active = useRef<string | null>(localStorage.getItem(LAST_RUN));
  const refresh = useCallback(async (id: string) => {
    const [next, receipts] = await Promise.all([api.run(id), api.ledger(id)]);
    if (active.current === id) { setRun(next); setLedger(receipts); }
  }, []);
  useEffect(() => {
    const id = active.current;
    if (id) void refresh(id).catch(e => setError(String(e.message)));
  }, [refresh]);
  useEffect(() => {
    if (!run) return;
    const id = run.run_id;
    const timer = setInterval(() => {
      void api.ledger(id).then(value => { if (active.current === id) setLedger(value); }).catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [run?.run_id]);
  async function guarded(fn: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
    finally { locked.current = false; setBusy(false); }
  }
  async function create(classId: ClassId) {
    await guarded(async () => {
      if (pending) throw new Error('Resolve the pending action before opening a new journey');
      const next = await api.create(classId, journeySeed());
      active.current = next.run_id; localStorage.setItem(LAST_RUN, next.run_id);
      setRun(next); setLedger(null); await refresh(next.run_id);
    });
  }
  async function deliver(job: Pending) {
    try {
      await api.action(job.run_id, job.action);
      localStorage.removeItem(PENDING); setPending(null);
      await refresh(job.run_id);
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        localStorage.removeItem(PENDING); setPending(null);
        await refresh(job.run_id);
      }
      throw e;
    }
  }
  async function act(input: ActionInput) {
    await guarded(async () => {
      if (!run || pending) throw new Error('Resolve the pending action first');
      const job = { run_id: run.run_id, action: { ...input, action_id: crypto.randomUUID(), expected_version: run.state.version } };
      localStorage.setItem(PENDING, JSON.stringify(job)); setPending(job);
      await deliver(job);
    });
  }
  const retry = () => guarded(async () => { if (pending) await deliver(pending); });
  /** Leave this journey (it stays saved on the server) and return to choosing a class. */
  function abandon() {
    if (locked.current) return;
    localStorage.removeItem(LAST_RUN); localStorage.removeItem(PENDING);
    active.current = null; setRun(null); setLedger(null); setPending(null); setError('');
  }
  const clearError = () => setError('');
  return { run, ledger, busy, error, pending, create, act, retry, abandon, clearError };
}
