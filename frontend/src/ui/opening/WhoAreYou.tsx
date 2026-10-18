import { useState } from "react";
import { LOOKS, NAME_MAX, ROBES, type AvatarFacing, type Profile } from "../../game/profile";
import { Avatar } from "./art";
import { Steps } from "./Steps";

const ROBE_COLORS: Record<string, string> = { own: "#1f3a5a", coral: "#b8573a", kelp: "#4f8a3a", night: "#3a3a6a" };
const TURN: AvatarFacing[] = ["front", "right", "back", "left"];

/** Step 1: a name for the Chronicle, a look and a robe. Looks never change the numbers. */
export function WhoAreYou({
  profile,
  onChange,
  onBack,
  onNext,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [turn, setTurn] = useState(0);
  const name = profile.name.trim();
  const surprise = () =>
    onChange({
      ...profile,
      look: LOOKS[Math.floor(Math.random() * LOOKS.length)],
      robe: ROBES[Math.floor(Math.random() * ROBES.length)],
    });

  return (
    <div className="opening wizard">
      <Steps step={1} />
      <h1 className="wizard__title">Who are you?</h1>
      <div className="who">
        <section className="panel who__preview">
          <button
            className="who__stage"
            onClick={() => setTurn((t) => (t + 1) % TURN.length)}
            aria-label="Turn around"
            title="Click to turn around"
          >
            <Avatar look={profile.look} robe={profile.robe} facing={TURN[turn]} scale={10} />
          </button>
          <p className="wizard__label">Your name in the Chronicle</p>
          <p className="who__plate">{name || "…"}</p>
        </section>

        <section className="panel who__form">
          <label className="wizard__label" htmlFor="player-name">
            Your name
          </label>
          <div className="who__name-row">
            <input
              id="player-name"
              className="who__name"
              value={profile.name}
              maxLength={NAME_MAX}
              placeholder="Name yourself"
              autoComplete="off"
              autoFocus
              onChange={(e) => onChange({ ...profile, name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && name && onNext()}
            />
            <span className="who__count">
              {profile.name.length}/{NAME_MAX}
            </span>
          </div>
          <p className="wizard__hint">Written in your Chronicle, and on your Passage if you earn it.</p>

          <div className="who__head">
            <p className="wizard__label">Your look</p>
            <button className="chip-button" onClick={surprise}>
              ⚄ Surprise me
            </button>
          </div>
          <div className="who__looks" role="radiogroup" aria-label="Your look">
            {LOOKS.map((look) => (
              <button
                key={look}
                role="radio"
                aria-checked={profile.look === look}
                className={`who__look ${profile.look === look ? "is-chosen" : ""}`}
                onClick={() => onChange({ ...profile, look })}
              >
                <Avatar look={look} robe={profile.robe} scale={2} />
              </button>
            ))}
          </div>

          <p className="wizard__label">Robe</p>
          <div className="who__robes" role="radiogroup" aria-label="Robe">
            {ROBES.map((robe) => (
              <button
                key={robe}
                role="radio"
                aria-checked={profile.robe === robe}
                className={`who__robe ${profile.robe === robe ? "is-chosen" : ""}`}
                onClick={() => onChange({ ...profile, robe })}
              >
                <span className="who__swatch" style={{ background: ROBE_COLORS[robe] }} />
                {robe}
              </button>
            ))}
          </div>

          <p className="wizard__note">How you look never changes your numbers. Anyone in Atlantis can start from any place.</p>
        </section>
      </div>
      <footer className="wizard__foot">
        <button className="pixel-button pixel-button--ghost" onClick={onBack}>
          ◀ Back
        </button>
        <button className="pixel-button" disabled={!name} onClick={onNext}>
          Next: where you start ▶
        </button>
      </footer>
    </div>
  );
}
