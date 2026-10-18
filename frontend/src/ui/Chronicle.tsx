import { useEffect, useState } from "react";
import { api } from "../api";
import type { Run } from "../types";
import { fmt, viewOf } from "./view";

interface Props {
  run: Run;
  /** The season that just ended. */
  season: string;
  onDone: () => void;
}

/** At each season's end: the Chronicle tells what happened, as a story (Gemini, or a template). */
export function Chronicle({ run, season, onDone }: Props) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api
      .chronicle(run.run_id, season)
      .then((c) => live && setText(c.text))
      .catch(() => live && setText("The tides turned, and the season passed into memory."));
    return () => {
      live = false;
    };
  }, [run.run_id, season]);
  const v = viewOf(run.state);
  return (
    <div className="card-backdrop">
      <section className="panel chronicle" role="dialog" aria-labelledby="chronicle-title">
        <p className="event-card__eyebrow">The Chronicle</p>
        <h2 id="chronicle-title" className="chronicle__title">
          The {season}
        </h2>
        <p className="chronicle__text">{text ?? "The scribes are writing…"}</p>
        <footer className="chronicle__foot">
          <span>
            {run.state.season} begins. Passage now costs <b className="num">{fmt(v.passage_price ?? 0)}</b>
          </span>
          <button className="button" onClick={onDone} autoFocus>
            Into the {run.state.season}
          </button>
        </footer>
      </section>
    </div>
  );
}
