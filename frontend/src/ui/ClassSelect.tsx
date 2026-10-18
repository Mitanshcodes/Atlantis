import { useState } from "react";
import type { ClassId } from "../types";
import { CLASSES } from "./copy";

interface Props {
  busy: boolean;
  error: string;
  onBegin: (classId: ClassId) => void;
}

/** The title screen: Atlantis sinks at year's end; choose where you start from. */
export function ClassSelect({ busy, error, onBegin }: Props) {
  const [chosen, setChosen] = useState<ClassId>("newcomer");
  return (
    <div className="screen">
      <div className="screen__inner">
        <header className="title">
          <p className="title__eyebrow">One year · Four seasons · One ship</p>
          <h1 className="title__name">Atlantis</h1>
          <p className="title__line">
            The city sinks at the year's end. Buy Passage on the last ship, paid in coin, owing nothing to anyone.
          </p>
        </header>
        <p className="screen__prompt">Everyone starts Atlantis from a different place. Choose yours.</p>
        <div className="classes" role="radiogroup" aria-label="Starting place">
          {CLASSES.map((c) => (
            <button
              key={c.id}
              role="radio"
              aria-checked={chosen === c.id}
              className={`panel class-card ${chosen === c.id ? "is-chosen" : ""}`}
              onClick={() => setChosen(c.id)}
            >
              <span className="class-card__name">{c.name}</span>
              <span className="class-card__job">{c.job}</span>
              <span className="class-card__start">{c.start}</span>
              <span className="class-card__label">Holding you back</span>
              <span className="class-card__text">{c.barrier}</span>
              <span className="class-card__label">On your side</span>
              <span className="class-card__text">{c.strength}</span>
            </button>
          ))}
        </div>
        {error && (
          <p className="screen__error" role="alert">
            {error}
          </p>
        )}
        <button className="button button--big" disabled={busy} onClick={() => onBegin(chosen)}>
          {busy ? "Opening the gates…" : "Begin the year"}
        </button>
      </div>
    </div>
  );
}
