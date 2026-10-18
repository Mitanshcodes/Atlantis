import { useEffect, useMemo, useState } from "react";
import type { Profile } from "../../game/profile";
import type { ClassId } from "../../types";
import { CLASSES, STORY } from "../copy";

/** ms per character, and the pause after each line. */
const TYPE_MS = 34;
const PAUSE_MS = 650;
const PASSAGE = 1200;
/** How many lines stay on screen at once. */
const KEEP_LINES = 3;

/**
 * Step 3: the story, as one cinematic screen. Big lines type themselves out over the drowned
 * city, one after another; older lines dim. Click or Enter finishes the line; when the last one
 * lands, Set sail appears. Words in content/onboarding.json ("story").
 */
export function Story({
  profile,
  classId,
  busy,
  error,
  onBack,
  onSail,
}: {
  profile: Profile;
  classId: ClassId;
  busy: boolean;
  error: string;
  onBack: () => void;
  onSail: () => void;
}) {
  const c = CLASSES.find((x) => x.id === classId) ?? CLASSES[0];
  const lines = useMemo(() => {
    const fill: Record<string, string> = {
      name: profile.name.trim(),
      class: c.title.replace(/^The /, "the "),
      coin: c.coin.toLocaleString("en-US"),
      passage: PASSAGE.toLocaleString("en-US"),
    };
    return STORY.map((l) => ({
      ...l,
      text: l.text.replace(/\{(\w+)\}/g, (_, k: string) => fill[k] ?? ""),
    }));
  }, [profile.name, c]);

  const still = useMemo(
    () =>
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    [],
  );
  const [line, setLine] = useState(still ? lines.length : 0);
  const [chars, setChars] = useState(0);
  const done = line >= lines.length;

  useEffect(() => {
    if (done) return;
    const text = lines[line].text;
    const timer =
      chars < text.length
        ? setTimeout(() => setChars(chars + 1), TYPE_MS)
        : setTimeout(() => (setLine(line + 1), setChars(0)), PAUSE_MS);
    return () => clearTimeout(timer);
  }, [line, chars, done, lines]);

  /** Finish the line being typed; if it's finished, move on; at the end, sail. */
  const advance = () => {
    if (busy) return;
    if (done) return onSail();
    if (chars < lines[line].text.length) setChars(lines[line].text.length);
    else (setLine(line + 1), setChars(0));
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
      <div className="cine__sea" aria-hidden="true" />
      <div className="cine__bubbles" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <i
            key={i}
            style={{
              left: `${(i * 37) % 100}%`,
              animationDelay: `${(i * 1.7) % 9}s`,
            }}
          />
        ))}
      </div>
      <button
        className="pixel-button pixel-button--ghost cine__skip"
        disabled={busy}
        onClick={(e) => (e.stopPropagation(), onSail())}
      >
        Skip story ▶
      </button>
      <button
        className="cine__back"
        onClick={(e) => (e.stopPropagation(), onBack())}
      >
        ◀ Back
      </button>

      <div className="cine__text" aria-live="polite">
        {lines.slice(0, line + 1).map((l, i) => {
          const typing = i === line;
          const bright = typing || (done && i === lines.length - 1);
          // Only the last few lines stay; older ones fade and fold away, like a fading memory.
          const gone = i < Math.min(line, lines.length - 1) - KEEP_LINES + 1;
          return (
            <p
              key={i}
              className={`cine__line cine__line--${l.style ?? "plain"} ${bright ? "is-now" : "is-past"} ${gone ? "is-gone" : ""}`}
            >
              {typing ? l.text.slice(0, chars) : l.text}
              {typing && <span className="cine__caret" aria-hidden="true" />}
            </p>
          );
        })}
      </div>

      <footer className={`cine__foot ${done ? "is-shown" : ""}`}>
        {error && (
          <p className="scroll-sheet__error" role="alert">
            {error}
          </p>
        )}
        <button
          className="pixel-button cine__sail"
          disabled={busy || !done}
          onClick={(e) => (e.stopPropagation(), onSail())}
        >
          {busy ? "Casting off…" : "Set sail ▶"}
        </button>
        <p className="cine__hint">
          {done ? "Press Enter" : "Click to hurry the tide"}
        </p>
      </footer>
    </div>
  );
}
