import type { Ledger, Run, State } from "../types";
import { fmt, viewOf, type GameView as HudView } from "./view";

const SEASONS = ["Spring", "Summer", "Autumn", "Long Dark"] as const;
const SCROLL_COUNT = 12;

/** The season, the money, the news and the Passage meter, laid over the corners of the city. */
export function Hud({
  run,
  ledger,
  onLedger,
  onScrolls,
}: {
  run: Run;
  ledger?: Ledger | null;
  onLedger?: () => void;
  onScrolls?: () => void;
}) {
  const { state } = run;
  const view = viewOf(state);
  return (
    <div className="hud">
      <SeasonPanel state={state} view={view} />
      <div className="hud__top-right">
        <Stats state={state} />
        <div className="hud__tabs">
          <button className="chip chip--button" onClick={onScrolls}>
            Scrolls {view.scrolls?.length ?? 0}/{SCROLL_COUNT}
          </button>
          <button className="chip chip--button" onClick={onLedger} title="Every coin movement, recorded on Nessie">
            Ledger <NessieStatus ledger={ledger} />
          </button>
        </div>
      </div>
      <News events={run.events} />
      <Passage state={state} view={view} />
    </div>
  );
}

/** A small mark for how the Nessie records stand: all confirmed, some waiting, or offline. */
function NessieStatus({ ledger }: { ledger?: Ledger | null }) {
  if (!ledger) return null;
  if (!ledger.live) return <span className="nessie nessie--off">offline</span>;
  const waiting = ledger.entries.filter((e) => e.status !== "confirmed").length;
  return waiting ? (
    <span className="nessie nessie--wait">{waiting} syncing</span>
  ) : (
    <span className="nessie nessie--ok">✓ Nessie</span>
  );
}

function SeasonPanel({ state, view }: { state: State; view: HudView }) {
  const index = view.season_index ?? Math.max(0, SEASONS.indexOf(state.season as (typeof SEASONS)[number]));
  const total = view.tides_total ?? 6;
  const used = Math.min(total, view.tide ?? total - state.tides);
  return (
    <section className="panel hud__season" aria-label="Season and tides">
      <header className="hud__season-head">
        <h1 className="hud__season-name">{state.season}</h1>
        <span className="hud__season-count">
          Season {index + 1} of {SEASONS.length}
        </span>
      </header>
      <ol className="hud__year">
        {SEASONS.map((name, i) => (
          <li key={name} className={i < index ? "is-past" : i === index ? "is-now" : ""}>
            <span className="hud__year-bar" />
            {name}
          </li>
        ))}
      </ol>
      <div className="hud__tides" aria-label={`${state.tides} of ${total} tides left`}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`tide ${i < used ? "is-spent" : i === used ? "is-now" : ""}`} />
        ))}
        <span className="hud__tides-left">
          {state.tides} {state.tides === 1 ? "tide" : "tides"} left
        </span>
      </div>
      <p className="hud__hint">
        Only work and trades spend a tide. Walking, talking and the Bank are free.
      </p>
      {view.hungry_next && <p className="hud__warn">A hungry season ahead: two fewer tides.</p>}
    </section>
  );
}

function Stats({ state }: { state: State }) {
  return (
    <dl className="hud__stats">
      <Stat label="Purse" value={fmt(state.purse)} />
      {state.vault !== null && <Stat label="Vault" value={fmt(state.vault)} />}
      {state.debt > 0 && <Stat label="Debts" value={`−${fmt(state.debt)}`} tone="debt" />}
      <Stat label="Standing" value={state.standing === null ? "Unrated" : String(state.standing)} tone="standing" />
    </dl>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "debt" | "standing" }) {
  return (
    <div className={`panel stat ${tone ? `stat--${tone}` : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function News({ events }: { events: string[] }) {
  const latest = events.slice(-2).reverse();
  if (!latest.length) return null;
  return (
    <section className="panel hud__news" aria-label="Word in the city" aria-live="polite">
      <p className="hud__eyebrow">Word in the city</p>
      {latest.map((line, i) => (
        <p key={i} className="hud__news-line">
          “<Numbers text={line} />”
        </p>
      ))}
    </section>
  );
}

/** Sentence text with its amounts set in the title face: the pixel face's 5 reads like an S. */
function Numbers({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\d[\d,]*(?:\.\d+)?%?◈?)/).map((part, i) =>
        i % 2 ? (
          <b key={i} className="num">
            {part}
          </b>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Passage({ state, view }: { state: State; view: HudView }) {
  const price = view.passage_price ?? 0;
  if (state.passage) {
    return (
      <section className="panel hud__passage hud__passage--paid" aria-label="Passage">
        <p className="hud__eyebrow">Passage on the last ship</p>
        <p className="hud__passage-paid">Your place aboard is paid.</p>
      </section>
    );
  }
  const coin = state.purse + (state.vault ?? 0);
  // Net worth is everything owned minus every debt, so what's owned beyond coin is "on paper".
  const onPaper = Math.max(0, (view.net_worth ?? coin - state.debt) + state.debt - coin);
  const pct = (v: number) => (price > 0 ? Math.min(100, (v / price) * 100) : 0);
  const coinPct = pct(coin);
  const paperPct = Math.min(100 - coinPct, pct(onPaper));
  return (
    <section className="panel hud__passage" aria-label="Passage on the last ship">
      <header className="hud__passage-head">
        <p className="hud__eyebrow">Passage on the last ship</p>
        <span className="hud__passage-price">{fmt(price)}</span>
      </header>
      <div className="meter" role="img" aria-label={`${fmt(coin)} in coin of ${fmt(price)}`}>
        <span className="meter__coin" style={{ width: `${coinPct}%` }} />
        <span className="meter__paper" style={{ width: `${paperPct}%` }} />
      </div>
      <dl className="hud__passage-legend">
        <div>
          <dt>
            <i className="key key--coin" />
            Coin to spend
          </dt>
          <dd>{fmt(coin)}</dd>
        </div>
        <div>
          <dt>
            <i className="key key--paper" />
            On paper
          </dt>
          <dd>{fmt(onPaper)}</dd>
        </div>
        <div>
          <dt>
            <i className="key key--debt" />
            Debts first
          </dt>
          <dd>{fmt(state.debt)}</dd>
        </div>
      </dl>
    </section>
  );
}
