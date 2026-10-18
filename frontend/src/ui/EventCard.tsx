import { useState } from "react";
import type { ActionInput } from "../store";
import type { Run } from "../types";
import { EVENT_TITLES, MOMENT_TITLES, SCROLLS } from "./copy";
import { toMinor, type Moment } from "./view";

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
  const tone = moment.kind === "scroll" ? "event-card--scroll" : moment.event === "lucky_salvage" ? "event-card--good" : "";

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
        <p className="event-card__eyebrow">{moment.kind === "scroll" ? "Scroll earned" : run.state.season}</p>
        <h2 id="event-title" className="event-card__title">
          {scroll ? scroll.name : title}
        </h2>
        <p className="event-card__text">{scroll ? scroll.how : moment.text}</p>
        <div className="event-card__actions">{actions}</div>
      </section>
    </div>
  );
}
