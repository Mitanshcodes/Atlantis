import { useState } from "react";
import type { ActionInput } from "../store";
import type { Run } from "../types";
import { DECK, EVENT_TITLES, MOMENT_TITLES, SCROLLS, SHOCKS } from "./copy";
import { toMinor, viewOf, type Moment } from "./view";

interface Props {
  moment: Moment;
  run: Run;
  busy: boolean;
  act: (input: ActionInput) => Promise<void>;
  onDone: () => void;
  /** Send the player to a building (Grin's offer points to the Black Reef). */
  onGo: (building: "black_reef") => void;
}

/** One thing that just happened, with what you can do about it. Cards queue; one shows at a time. */
export function EventCard({ moment, run, busy, act, onDone, onGo }: Props) {
  const [amount, setAmount] = useState("");
  const can = (kind: string) => run.state.available_actions.includes(kind);
  const title =
    moment.kind === "event" ? EVENT_TITLES[moment.event ?? ""] ?? "Something Happened" : MOMENT_TITLES[moment.kind] ?? "News";
  const scroll = moment.scroll ? SCROLLS[moment.scroll] : undefined;
  if (moment.kind === "scroll" && scroll) {
    const earned = viewOf(run.state).scrolls?.length ?? 0;
    return <AchievementCard name={scroll.name} how={scroll.how} earned={earned} onDone={onDone} />;
  }
  const shock = moment.kind === "market_shock" && moment.shock ? SHOCKS[moment.shock] : undefined;
  const means = shock?.means ?? (moment.kind === "event" ? DECK[moment.event ?? ""]?.means : undefined);
  const tone =
    moment.kind === "scroll"
      ? "event-card--scroll"
      : moment.kind === "market_shock"
        ? "event-card--shock"
        : moment.event === "lucky_salvage"
          ? "event-card--good"
          : "";

  let actions = (
    <button className="button" onClick={onDone} autoFocus>
      Onward
    </button>
  );
  if (moment.event === "fraud_charge" && can("dispute_charge")) {
    actions = (
      <>
        <button className="button" disabled={busy} onClick={() => void act({ kind: "dispute_charge" }).then(onDone)} autoFocus>
          Dispute it
        </button>
        <button className="button button--quiet" onClick={onDone}>
          Let it go
        </button>
      </>
    );
  } else if (moment.event === "pearl_exchange" && can("invest_pearl_exchange")) {
    const valid = /^\d+$/.test(amount) && Number(amount) > 0;
    actions = (
      <>
        <input
          className="event-card__input"
          inputMode="numeric"
          placeholder="◈"
          aria-label="Amount to invest"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
        />
        <button
          className="button button--quiet"
          disabled={busy || !valid}
          onClick={() => void act({ kind: "invest_pearl_exchange", amount: toMinor(Number(amount)) }).then(onDone)}
        >
          Invest
        </button>
        <button className="button" onClick={onDone} autoFocus>
          Walk away
        </button>
      </>
    );
  } else if (moment.event === "grins_offer") {
    actions = (
      <>
        <button className="button button--quiet" onClick={() => (onGo("black_reef"), onDone())}>
          Go to the Black Reef
        </button>
        <button className="button" onClick={onDone} autoFocus>
          Not today
        </button>
      </>
    );
  }

  return (
    <div className="card-backdrop">
      <section className={`panel event-card ${tone}`} role="alertdialog" aria-labelledby="event-title">
        <p className="event-card__eyebrow">
          {moment.kind === "scroll"
            ? "Scroll earned"
            : shock
              ? `Market news · ${moment.season ?? run.state.season}`
              : moment.season ?? run.state.season}
        </p>
        <h2 id="event-title" className="event-card__title">
          {scroll ? scroll.name : shock ? shock.title : title}
        </h2>
        <p className="event-card__text">{scroll ? scroll.how : shock ? shock.story : moment.text}</p>
        {means && <p className="event-card__means">{means}</p>}
        <div className="event-card__actions">{actions}</div>
      </section>
    </div>
  );
}

interface AchievementProps {
  name: string;
  how: string;
  /** Scrolls earned so far, this one included. */
  earned: number;
  onDone: () => void;
}

/**
 * A Scroll earned: the year's achievements. A gold ribbon, then the Scroll itself unrolled on
 * parchment between gilded rods, sealed in wax, with light turning slowly behind it.
 */
function AchievementCard({ name, how, earned, onDone }: AchievementProps) {
  return (
    <div className="card-backdrop achievement-backdrop">
      <div className="achievement" role="alertdialog" aria-labelledby="achievement-name" aria-describedby="achievement-how">
        <div className="achievement__rays" aria-hidden="true" />
        <p className="achievement__ribbon">
          <span>Achievement unlocked!</span>
        </p>
        <div className="achievement__scroll">
          <span className="achievement__rod" aria-hidden="true" />
          <div className="achievement__parchment">
            <p className="achievement__eyebrow">A new Scroll</p>
            <h2 id="achievement-name" className="achievement__name">
              {name}
            </h2>
            <p id="achievement-how" className="achievement__how">
              {how}
            </p>
            <p className="achievement__count">
              {earned} of {Object.keys(SCROLLS).length} Scrolls earned
            </p>
            <span className="achievement__seal" aria-hidden="true">
              ◈
            </span>
          </div>
          <span className="achievement__rod" aria-hidden="true" />
        </div>
        <span className="achievement__sparkle achievement__sparkle--a" aria-hidden="true">
          ✦
        </span>
        <span className="achievement__sparkle achievement__sparkle--b" aria-hidden="true">
          ✦
        </span>
        <span className="achievement__sparkle achievement__sparkle--c" aria-hidden="true">
          ✧
        </span>
        <button className="button achievement__button" onClick={onDone} autoFocus>
          Onward
        </button>
      </div>
    </div>
  );
}
