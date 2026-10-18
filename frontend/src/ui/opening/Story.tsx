import { useEffect, useMemo, useState } from "react";
import type { Profile } from "../../game/profile";
import type { ClassId } from "../../types";

/** ms per character, and the fade between beats. */
const TYPE_MS = 35;
const FADE_MS = 200;

type Tone = "ancient" | "gold" | "plain";

/** The prophecy, one beat per box. */
const BEATS: Array<{ text: string; tone: Tone }> = [
  { text: "For a thousand tides, an ancient prophecy has travelled through the Deep Sea.", tone: "ancient" },
  { text: "Atlantis will sink beneath the sea one year from today.", tone: "gold" },
  { text: "When the Long Dark ends, the last ship leaves the harbor,", tone: "plain" },
  { text: "and only those who hold a Ticket of Passage will be aboard.", tone: "plain" },
  { text: "The price of Passage climbs with every season,", tone: "plain" },
  { text: "and the harbor master takes only coin. Never pearls, promises or debts.", tone: "plain" },
  { text: "You have four seasons to work, save, trade and invest your way to that ticket.", tone: "plain" },
  { text: "Every choice you make will either carry you toward the ship…", tone: "plain" },
  { text: "…or leave you watching it sail.", tone: "plain" },
  { text: "Choose wisely. The tide is already turning.", tone: "gold" },
];
const LAST = BEATS.length - 1;

/**
 * The background's small life, placed in percent of the title art (title_scene.png): stars that
 * twinkle in its sky (above the horizon at 41%), and glints drifting on its open water, kept clear
 * of the temple on the right. A fixed formula, so they sit in the same places every time.
 */
const STARS = Array.from({ length: 34 }, (_, i) => ({
  x: (i * 37.3 + 11) % 100,
  y: 3 + ((i * 53.7) % 34),
  big: i % 7 === 0,
  dur: 2.4 + (i % 5) * 0.7,
  delay: (i * 0.83) % 5,
})).filter((s) => !(s.x > 76 && s.x < 93 && s.y < 26)); // not on the moon
const GLINTS = Array.from({ length: 16 }, (_, i) => ({
  x: (i * 23.9 + 4) % 58,
  y: 43 + ((i * 17.3) % 24),
  w: 1.4 + (i % 3) * 0.8,
  delay: (i * 0.9) % 6,
}));

interface Props {
  profile: Profile;
  classId: ClassId;
  busy: boolean;
  error: string;
  onBack: () => void;
  onSail: () => void;
}

/**
 * Step 3: the story, told beat by beat in a dialogue box at the foot of the drowned city. Each
 * beat types itself out; click, Enter or Space finishes it, then moves on. After the last beat,
 * Set sail fades in. With reduced motion, every beat appears whole and nothing fades.
 */
export function Story({ busy, error, onBack, onSail }: Props) {
  const still = useMemo(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false, []);
  const [beat, setBeat] = useState(0);
  const [chars, setChars] = useState(still ? BEATS[0].text.length : 0);
  const [fading, setFading] = useState(false);

  const text = BEATS[beat].text;
  const typed = chars >= text.length;
  const done = beat === LAST && typed;

  useEffect(() => {
    if (typed || fading) return;
    const timer = setTimeout(() => setChars(chars + 1), TYPE_MS);
    return () => clearTimeout(timer);
  }, [chars, typed, fading]);

  const goTo = (next: number) => {
    const show = () => {
      setBeat(next);
      setChars(still ? BEATS[next].text.length : 0);
      setFading(false);
    };
    if (still) return show();
    setFading(true);
    setTimeout(show, FADE_MS);
  };

  /** Finish the beat being typed; if it's finished, go on to the next; after the last, sail. */
  const advance = () => {
    if (busy || fading) return;
    if (!typed) setChars(text.length);
    else if (beat < LAST) goTo(beat + 1);
    else onSail();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        advance();
      } else if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="opening cine" onClick={advance}>
      <div className="cine__sea" aria-hidden="true">
        <div className="cine__scene">
          {STARS.map((star, i) => (
            <i
              key={i}
              className={`cine__star ${star.big ? "cine__star--big" : ""}`}
              style={{ left: `${star.x}%`, top: `${star.y}%`, animationDuration: `${star.dur}s`, animationDelay: `${star.delay}s` }}
            />
          ))}
          <i className="cine__moon" />
          <i className="cine__moon-sparkle" />
          <i className="cine__swell" />
          {GLINTS.map((g, i) => (
            <i
              key={i}
              className="cine__glint"
              style={{ left: `${g.x}%`, top: `${g.y}%`, width: `${g.w}%`, animationDelay: `${g.delay}s` }}
            />
          ))}
        </div>
      </div>
      <div className="cine__bubbles" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 1.7) % 9}s` }} />
        ))}
      </div>
      <button
        className="pixel-button pixel-button--ghost cine__skip"
        disabled={busy}
        onClick={(e) => (e.stopPropagation(), onSail())}
      >
        Skip story ▶
      </button>
      <button className="cine__back" onClick={(e) => (e.stopPropagation(), onBack())}>
        ◀ Back
      </button>

      <div className="cine__stage">
        <section className={`story-box ${fading ? "is-fading" : ""}`} aria-live="polite">
          <p className={`story-box__line story-box__line--${BEATS[beat].tone}`}>
            {text.slice(0, chars)}
            {/* The rest of the line, invisible, so the box keeps its size as the words type. */}
            <span className="story-box__unwritten" aria-hidden="true">
              {text.slice(chars)}
            </span>
          </p>
          {typed && !fading && (
            <span className="story-box__next" aria-hidden="true">
              ▼
            </span>
          )}
        </section>

        <footer className={`cine__foot ${done ? "is-shown" : ""}`}>
          {error && (
            <p className="scroll-sheet__error" role="alert">
              {error}
            </p>
          )}
          <button
            className="pixel-button cine__sail"
            disabled={busy || !done}
            tabIndex={done ? 0 : -1}
            onClick={(e) => (e.stopPropagation(), onSail())}
          >
            {busy ? "Casting off…" : "Set sail ▶"}
          </button>
          <p className="cine__hint">Press Enter</p>
        </footer>
      </div>
    </div>
  );
}
