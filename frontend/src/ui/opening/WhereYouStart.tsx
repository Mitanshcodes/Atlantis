import type { Profile } from "../../game/profile";
import type { ClassId } from "../../types";
import { CLASSES } from "../copy";
import { Chelo, CheloSays, ClassScene } from "./art";
import { Steps } from "./Steps";

/** Step 2: the four starting places, each with the player standing in its workplace. */
export function WhereYouStart({
  profile,
  chosen,
  onChoose,
  onBack,
  onNext,
}: {
  profile: Profile;
  chosen: ClassId;
  onChoose: (id: ClassId) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const current = CLASSES.find((c) => c.id === chosen) ?? CLASSES[0];
  // Whole-pixel scenes: 5x where there's room, 4x on shorter screens so Chelo stays in view.
  const scale = window.innerHeight >= 1080 && window.innerWidth >= 1500 ? 5 : 4;
  return (
    <div className="opening wizard">
      <Steps step={2} />
      <h1 className="wizard__title">Where does {profile.name.trim()} start?</h1>
      <p className="wizard__sub">Everyone in Atlantis starts from a different place. Each one is hard in its own way.</p>
      <div className="starts" role="radiogroup" aria-label="Where you start">
        {CLASSES.map((c) => (
          <button
            key={c.id}
            role="radio"
            aria-checked={chosen === c.id}
            className={`start-card ${chosen === c.id ? "is-chosen" : ""}`}
            onClick={() => onChoose(c.id)}
            onDoubleClick={onNext}
          >
            <span className="start-card__art">
              <ClassScene scene={c.scene} look={profile.look} robe={profile.robe} scale={scale} />
              {chosen === c.id && <span className="start-card__chosen">Chosen</span>}
            </span>
            <span className="start-card__title">{c.title}</span>
            <span className="start-card__job">{c.job}</span>
            <span className="start-card__coin">
              <i className="coin" />
              <b>{c.coin}◈</b>
              {c.coinNote && <span className="start-card__debt">{c.coinNote}</span>}
            </span>
            <span className="start-card__label start-card__label--hard">The hard part</span>
            <span className="start-card__text">{c.hard}</span>
            <span className="start-card__label start-card__label--edge">Your edge</span>
            <span className="start-card__text">{c.edge}</span>
            <span className="start-card__standing">
              <span>Standing</span>
              <b>{c.standing}</b>
            </span>
          </button>
        ))}
      </div>
      <footer className="wizard__foot wizard__foot--chelo">
        <span className="wizard__chelo">
          <Chelo scale={3} />
        </span>
        <CheloSays key={current.id} text={current.chelo} />
        <span className="wizard__buttons">
          <button className="pixel-button pixel-button--ghost" onClick={onBack}>
            ◀ Back
          </button>
          <button className="pixel-button" onClick={onNext}>
            Begin ▶
          </button>
        </span>
      </footer>
    </div>
  );
}
