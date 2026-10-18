import { useEffect, useState, type ReactNode } from "react";
import type { Profile } from "../../game/profile";
import type { ClassId } from "../../types";
import { CLASSES } from "../copy";
import { Chelo, CheloSays, ClassScene } from "./art";
import { Steps } from "./Steps";

interface Page {
  title: string;
  art?: ReactNode;
  heading?: string;
  body: string;
  stats: Array<[string, string]>;
  chelo: string;
}

/** Step 3: the story, on a scroll, four pages, with Chelo narrating. The last page sets sail. */
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
  const name = profile.name.trim();
  const pages: Page[] = [
    {
      title: "Who You Are",
      art: <ClassScene scene={c.scene} look={profile.look} robe={profile.robe} scale={3} />,
      heading: `You are ${name}, ${c.name}.`,
      body: c.story,
      stats: [
        ["Purse", `${c.coin}◈`],
        ["Pay a shift", c.pay],
        ["Standing", c.standing],
      ],
      chelo: `Hello, ${name}! I'm Chelo. I've watched these tides for three hundred years, and I've never seen them rise like this.`,
    },
    {
      title: "The Sinking",
      body: "The Council of Ten has read the tides: Atlantis sinks at the end of the Long Dark. One year remains, in four seasons: Spring, Summer, Autumn and the Long Dark. Each gives you six tides to spend.",
      stats: [
        ["Seasons", "4"],
        ["Tides a season", "6"],
        ["Then", "The sea"],
      ],
      chelo: "The Council's word is always true. When they say the city sinks, it sinks.",
    },
    {
      title: "The Last Ship",
      body: "One ship leaves before the end. Passage costs 1,200◈ this Spring, and the price climbs every season. It's paid in coin, and sold only to those who owe no one.",
      stats: [
        ["Passage now", "1,200◈"],
        ["Each season", "Dearer"],
        ["Debts allowed", "None"],
      ],
      chelo: "Mark me: the price only goes up. Waiting is a choice too.",
    },
    {
      title: "Every Coin Counts",
      body: "Work at the Guild Hall. Keep coin safe in the Vault. Trade at the Grand Market and the Harbor Exchange. Prices rise, so coin left idle loses ground. Every coin you move is recorded in Capital One's Nessie ledger.",
      stats: [
        ["Work", "1 tide"],
        ["The Bank", "Free"],
        ["Ledger", "Nessie"],
      ],
      chelo: "Spend your tides wisely and the sea forgives a great deal. Off you go!",
    },
  ];
  const [page, setPage] = useState(0);
  const last = page === pages.length - 1;
  const p = pages[page];
  const next = () => (last ? onSail() : setPage(page + 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy) return;
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft" && page > 0) setPage(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="opening wizard story">
      <Steps step={3} label="The story" align="left" />
      <button className="pixel-button pixel-button--ghost story__skip" disabled={busy} onClick={onSail}>
        Skip story ▶
      </button>
      <div className="story__narrator">
        <CheloSays key={page} label="Chelo · Keeper of the Tides" text={p.chelo} />
        <span className="story__chelo">
          <Chelo scale={9} />
        </span>
      </div>

      <section className="scroll-sheet" aria-live="polite">
        <span className="scroll-sheet__roller scroll-sheet__roller--top" aria-hidden="true" />
        <div className="scroll-sheet__paper">
          <span className="scroll-sheet__seal" aria-hidden="true" />
          <p className="scroll-sheet__eyebrow">
            The Long Night · {page + 1} of {pages.length}
          </p>
          <h2 className="scroll-sheet__title">{p.title}</h2>
          <p className="scroll-sheet__divider" aria-hidden="true">
            ✦
          </p>
          {p.art && <div className="scroll-sheet__art">{p.art}</div>}
          {p.heading && <h3 className="scroll-sheet__heading">{p.heading}</h3>}
          <p className="scroll-sheet__body">{p.body}</p>
          <dl className="scroll-sheet__stats">
            {p.stats.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {error && (
            <p className="scroll-sheet__error" role="alert">
              {error}
            </p>
          )}
          <nav className="scroll-sheet__nav">
            <button className="scroll-sheet__arrow" disabled={busy} onClick={() => (page ? setPage(page - 1) : onBack())} aria-label="Previous page">
              ◀
            </button>
            <span className="scroll-sheet__pips" aria-hidden="true">
              {pages.map((_, i) => (
                <i key={i} className={i === page ? "is-now" : ""} />
              ))}
            </span>
            {last ? (
              <button className="pixel-button scroll-sheet__sail" disabled={busy} onClick={onSail}>
                {busy ? "Casting off…" : "Set sail ▶"}
              </button>
            ) : (
              <button className="scroll-sheet__arrow" onClick={next} aria-label="Next page">
                ▶
              </button>
            )}
          </nav>
        </div>
        <span className="scroll-sheet__roller scroll-sheet__roller--bottom" aria-hidden="true" />
      </section>
    </div>
  );
}
