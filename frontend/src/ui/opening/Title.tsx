import { useEffect, useState } from "react";
import { Chelo } from "./art";

interface Props {
  /** "Summer · tide 3" for a saved journey; null when there's nothing to continue. */
  saved: string | null;
  onNew: () => void;
  onContinue: () => void;
}

/**
 * The title: a night sea, the last ship bobbing at anchor, and Atlantis already half under. The art
 * covers the screen at 16:10 (title_scene, with the ship layer at (144, 144) on the 4x canvas).
 */
export function Title({ saved, onNew, onContinue }: Props) {
  const [help, setHelp] = useState(false);
  const items = [
    { id: "new", label: "New Voyage", run: onNew },
    { id: "continue", label: "Continue", run: onContinue, disabled: !saved, note: saved },
    { id: "help", label: "How to Play", run: () => setHelp(true) },
  ];
  const [focus, setFocus] = useState(saved ? 1 : 0);

  useEffect(() => {
    if (help) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocus((f) => {
          let next = f;
          do next = (next + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
          while (items[next].disabled);
          return next;
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        items[focus].run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="opening title-screen">
      <div className="night-art" aria-hidden="true">
        <img className="pixel night-art__scene" src="assets/opening/title/title_scene.png" alt="" />
        <img className="pixel night-art__ship" src="assets/opening/title/title_ship@4x.png" alt="" />
        <span className="night-art__chelo">
          <Chelo scale={3} />
        </span>
      </div>
      <p className="title-screen__build">Technica 2026 · v0.1</p>

      <div className="title-screen__panel">
        <h1 className="title-screen__name">Atlantis</h1>
        <p className="title-screen__sub">
          <span className="rule" />✦<span className="title-screen__sub-text">The Long Night</span>✦<span className="rule" />
        </p>
        <p className="title-screen__line">
          One year until the sea takes the city. One last ship.
          <br />
          Earn your Passage, and owe no one.
        </p>
        <nav className="title-menu" aria-label="Main menu">
          {items.map((item, i) => (
            <button
              key={item.id}
              className={`title-menu__item ${i === focus ? "is-focus" : ""}`}
              disabled={item.disabled}
              onMouseEnter={() => !item.disabled && setFocus(i)}
              onClick={item.run}
            >
              <span className="title-menu__caret">{i === focus ? "▶" : ""}</span>
              {item.label}
              {item.note && <span className="title-menu__note">{item.note}</span>}
            </button>
          ))}
        </nav>
      </div>

      <p className="title-screen__press">Press Enter to set sail</p>
      <aside className="title-screen__badge">
        <span className="title-screen__badge-head">Real banking, under the sea</span>
        Every coin is a Capital One Nessie transaction
      </aside>

      {help && <HowToPlay onClose={() => setHelp(false)} />}
    </div>
  );
}

function HowToPlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => (e.key === "Escape" || e.key === "Enter") && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="card-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="panel how-to" role="dialog" aria-labelledby="how-title">
        <h2 id="how-title" className="chronicle__title">
          How to Play
        </h2>
        <ol className="how-to__list">
          <li>Atlantis sinks at the end of the Long Dark. You have four seasons, six tides each.</li>
          <li>Click a building to go in. Work, trade at the Market or the Exchange: those spend tides. The Bank is free.</li>
          <li>Buy Passage on the last ship at the Harbor Exchange, in coin, owing nothing to anyone.</li>
          <li>Passage gets dearer every season, and the Council can thin the coin. Coin left idle loses ground.</li>
          <li>Drag to look around the city. Scroll to zoom.</li>
        </ol>
        <button className="button" onClick={onClose} autoFocus>
          Got it
        </button>
      </section>
    </div>
  );
}
