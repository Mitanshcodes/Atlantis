import { useEffect, useState } from "react";
import type { Run } from "../types";
import type { Heard } from "./npcTalk";

const KEEP = 60;
const storageKey = (runId: string) => `atlantis.p3.heard.${runId}`;

function load(runId: string): Heard[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(runId)) || "[]") as Heard[];
  } catch {
    return [];
  }
}

/**
 * Everything the engine has announced this journey. Each response only carries the lines its own
 * action caused, so the people of the city keep a running memory here (per journey, in the
 * browser) to know the latest tavern talk, clues and news.
 */
export function useHeard(run: Run | null): Heard[] {
  const [heard, setHeard] = useState<Heard[]>([]);
  const runId = run?.run_id;
  const version = run?.state.version;

  useEffect(() => {
    if (!run || runId === "demo") {
      setHeard(run ? run.events.map((text) => ({ version: run.state.version, text })) : []);
      return;
    }
    const known = load(run.run_id);
    const seen = known.some((h) => h.version === run.state.version);
    const next = seen ? known : [...known, ...run.events.map((text) => ({ version: run.state.version, text }))].slice(-KEEP);
    try {
      localStorage.setItem(storageKey(run.run_id), JSON.stringify(next));
    } catch {
      // Storage full or blocked: the memory just won't outlive the page.
    }
    setHeard(next);
    // Only a new journey or a new version brings new lines.
  }, [runId, version]);

  return heard;
}
