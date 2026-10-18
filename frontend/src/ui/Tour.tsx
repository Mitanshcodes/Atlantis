import { useEffect, useState, type CSSProperties } from "react";
import { BUILDINGS_BY_ID } from "../game/buildings";
import { EventBus } from "../game/EventBus";
import { BUILDING_INFO, TOUR } from "./copy";
import { Chelo, CheloSays } from "./opening/art";

const DONE_KEY = "atlantis.toured";

/** Whether this browser has already seen (or skipped) Chelo's tour. */
export function toured(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Chelo's first-time tour: the camera glides to each building while a panel says what it's for,
 * then points at the season and the Passage meter. Words are in content/onboarding.json and, for
 * buildings, the same explanations the rooms fold under "How this place works".
 */
export function Tour({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const step = TOUR[index];
  const last = index === TOUR.length - 1;
  const building = step.building ? BUILDINGS_BY_ID[step.building] : undefined;
  const info = step.building ? BUILDING_INFO[step.building] : undefined;

  const finish = () => {
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {
      // Private windows: the tour just shows again next time.
    }
    EventBus.emit("tour-focus", null);
    onDone();
  };
  const next = () => (last ? finish() : setIndex(index + 1));
  const back = () => index > 0 && setIndex(index - 1);

  // Where the building is on screen, for the spotlight (the city sends it as the camera glides).
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => EventBus.on("tour-spot", setSpot), []);
  useEffect(() => {
    if (step.building) EventBus.emit("tour-focus", step.building);
  }, [step.building]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Enter on a focused button already clicks it.
      if (
        e.key === "ArrowRight" ||
        (e.key === "Enter" && !(e.target instanceof HTMLButtonElement))
      )
        next();
      else if (e.key === "ArrowLeft") back();
      else if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const title = building ? building.name : step.title;
  const lines = info ? info.do : (step.lines ?? []);
  return (
    <div
      className={`tour ${building && spot ? "tour--building" : ""}`}
      data-hud={step.hud}
      style={spot ? ({ "--spot-x": `${spot.x}px`, "--spot-y": `${spot.y}px` } as CSSProperties) : undefined}
    >
      <section
        className="tour__panel panel"
        role="dialog"
        aria-labelledby="tour-title"
        aria-live="polite"
      >
        <div className="tour__guide">
          <Chelo scale={4} />
        </div>
        <div className="tour__body">
          <CheloSays
            key={step.id}
            label="Chelo · Keeper of the Tides"
            text={step.chelo}
          />
          <p className="tour__eyebrow">
            {building ? building.keeper : "Getting started"} · {index + 1} of{" "}
            {TOUR.length}
          </p>
          <h2 id="tour-title" className="tour__title">
            {title}
          </h2>
          {info && <p className="tour__about">{info.about}</p>}
          <ul className="tour__lines">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {info && <p className="tour__cost">{info.cost}</p>}
          <nav className="tour__nav">
            <button className="button button--quiet" onClick={finish}>
              Skip tour
            </button>
            <span className="tour__pips" aria-hidden="true">
              {TOUR.map((s, i) => (
                <i
                  key={s.id}
                  className={
                    i === index ? "is-now" : i < index ? "is-done" : ""
                  }
                />
              ))}
            </span>
            <span className="tour__steps">
              <button
                className="button button--quiet"
                disabled={index === 0}
                onClick={back}
              >
                Back
              </button>
              <button className="button" onClick={next} autoFocus>
                {last ? "Start playing" : "Next"}
              </button>
            </span>
          </nav>
        </div>
      </section>
    </div>
  );
}
