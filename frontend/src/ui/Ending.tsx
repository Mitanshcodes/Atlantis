import type { ActionInput } from "../store";
import type { Run } from "../types";
import { loadProfile } from "../game/profile";
import { ENDINGS, MIRROR } from "./copy";
import { ScrollGrid } from "./Scrolls";
import { fmt, viewOf } from "./view";

/** The Long Dark's tides are spent: settle up, then face the Passage check. */
export function FinalCall({
  run,
  busy,
  act,
  onBank,
}: {
  run: Run;
  busy: boolean;
  act: (input: ActionInput) => Promise<void>;
  onBank: () => void;
}) {
  const { state } = run;
  const v = viewOf(state);
  const price = v.passage_price ?? 0;
  const coin = state.purse + (state.vault ?? 0);
  const ready = state.passage || (state.debt === 0 && coin >= price);
  return (
    <div className="card-backdrop">
      <section className="panel final-call" role="dialog" aria-labelledby="final-title">
        <p className="event-card__eyebrow">The end of the Long Dark</p>
        <h2 id="final-title" className="chronicle__title">
          The Last Ship Is Calling
        </h2>
        <ul className="checklist">
          <li className={state.passage || state.debt === 0 ? "is-ok" : "is-no"}>
            {state.debt === 0 ? "You owe nothing" : `You still owe ${fmt(state.debt)}`}
          </li>
          <li className={state.passage || coin >= price ? "is-ok" : "is-no"}>
            {state.passage ? "Passage is paid" : `Passage costs ${fmt(price)}; you hold ${fmt(coin)} in coin`}
          </li>
        </ul>
        <p className="room__note">
          The Market and the Exchange have closed. The Bank is still open: pay what you owe and gather your coin. The Harbor
          takes Vault coin too.
        </p>
        <div className="event-card__actions">
          {!state.passage && (
            <button className="button button--quiet" onClick={onBank}>
              Go to the Bank
            </button>
          )}
          <button className="button" disabled={busy} onClick={() => void act({ kind: "end_year" })} autoFocus>
            {ready ? "Board the ship" : "Face the harbor"}
          </button>
        </div>
      </section>
    </div>
  );
}

/** How the year ended, the Modern Mirror (the real-world lesson), and the Scrolls you earned. */
export function Ending({ run, onAgain }: { run: Run; onAgain: () => void }) {
  const v = viewOf(run.state);
  const ending = ENDINGS[v.ending ?? "missed_the_ship"];
  const mirrorKey = v.ending === "missed_the_ship" ? v.miss_cause ?? "no_savings" : v.ending ?? "";
  const earned = new Set(v.scrolls ?? []);
  const escaped = v.ending !== "missed_the_ship";
  return (
    <div className="screen">
      <div className="screen__inner ending">
        <p className="title__eyebrow">The year is over</p>
        <h1 className={`ending__title ${escaped ? "is-escaped" : "is-lost"}`}>{ending.title}</h1>
        <p className="title__line">{ending.line.replace("{name}", loadProfile()?.name || "The traveller")}</p>
        <section className="panel mirror">
          <p className="hud__eyebrow">The Modern Mirror</p>
          <p className="mirror__text">{MIRROR[mirrorKey]}</p>
        </section>
        <dl className="ending__stats">
          <div>
            <dt>Coin at the end</dt>
            <dd className="num">{fmt(run.state.purse + (run.state.vault ?? 0))}</dd>
          </div>
          <div>
            <dt>Everything you owned</dt>
            <dd className="num">{fmt(v.net_worth ?? 0)}</dd>
          </div>
          <div>
            <dt>Scrolls</dt>
            <dd className="num">{earned.size} / 12</dd>
          </div>
        </dl>
        <ScrollGrid earned={earned} />
        <button className="button button--big" onClick={onAgain}>
          Begin another year
        </button>
      </div>
    </div>
  );
}
