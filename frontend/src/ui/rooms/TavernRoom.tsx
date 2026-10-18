import { useEffect, useRef, useState } from "react";
import { TAVERN } from "../copy";
import { fmt, momentsOf, toMinor, type Moment } from "../view";
import { Section, can, view, type RoomProps } from "./kit";

const STAKES = [5, 10, 25, 50, 100];

/** The Kraken's Wheel, as slices of a circle (degrees), matching config.GAMES["wheel"]. */
const WHEEL: Array<{ multiple: number; share: number; color: string; label: string }> = [
  { multiple: 0, share: 0.71, color: "#1d2f3d", label: "Kraken" },
  { multiple: 2, share: 0.2, color: "#2a8a8f", label: "2×" },
  { multiple: 4, share: 0.07, color: "#d9a84c", label: "4×" },
  { multiple: 10, share: 0.02, color: "#e8624a", label: "10×" },
];

/** Where each slice starts and ends, going clockwise from the top. */
const SLICES = WHEEL.reduce<Array<(typeof WHEEL)[number] & { from: number; to: number }>>((acc, s) => {
  const from = acc.length ? acc[acc.length - 1].to : 0;
  return [...acc, { ...s, from, to: from + s.share * 360 }];
}, []);
const WHEEL_BG = `conic-gradient(${SLICES.map((s) => `${s.color} ${s.from}deg ${s.to}deg`).join(", ")})`;

/** Nerissa's tavern: rumors, and two honest games of chance that pay back a little less than they take. */
export function TavernRoom({ room }: { room: RoomProps }) {
  const { state } = room.run;
  const v = view(room.run);
  const tavern = v.tavern;
  const [stake, setStake] = useState(10);
  // Only results that arrive while you're at the table get revealed.
  const openedAt = useRef(state.version);
  const result: Moment | undefined =
    state.version > openedAt.current ? momentsOf(state).find((m) => m.kind === "gamble") : undefined;
  const talk = room.run.events.filter((line) => /Tavern talk|Nerissa|Captain Oro|Herald Kaito|rumor/.test(line)).slice(-3);
  const canPlay = can(room.run, "gamble");
  const affordable = (s: number) => toMinor(s) <= state.purse;
  const play = (game: string, pick?: number) =>
    void room.act({ kind: "gamble", target: game, amount: toMinor(stake), ...(pick ? { quantity: pick } : {}) });

  return (
    <>
      <Section
        title="Nerissa's games"
        aside={<span className="tag tag--tide">{tavern?.games_left ?? 0} of 3 games left this season</span>}
      >
        <div className="stakes" role="radiogroup" aria-label="Your stake">
          <span className="stakes__label">Stake</span>
          {STAKES.map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={stake === s}
              className={`stakes__chip ${stake === s ? "is-chosen" : ""}`}
              disabled={!affordable(s)}
              onClick={() => setStake(s)}
            >
              {s}◈
            </button>
          ))}
        </div>
        {!canPlay && <p className="room__note">{TAVERN.limit}</p>}

        <div className="games">
          <Shells result={result?.game === "shells" ? result : undefined} disabled={!canPlay || room.busy || !affordable(stake)} onPick={(pick) => play("shells", pick)} />
          <Wheel result={result?.game === "wheel" ? result : undefined} disabled={!canPlay || room.busy || !affordable(stake)} onSpin={() => play("wheel")} />
        </div>

        {result && <Outcome result={result} version={state.version} />}
        {tavern && tavern.net !== 0 && (
          <p className="room__note">
            This year at Nerissa's tables: <b className={tavern.net > 0 ? "gain" : "loss"}>{tavern.net > 0 ? "+" : "−"}{fmt(Math.abs(tavern.net))}</b>
          </p>
        )}
      </Section>

      <Section title="Overheard">
        {talk.length ? (
          <ul className="news-list">
            {talk.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="room__note">Nothing worth repeating yet. Linger a while; talk finds those who listen.</p>
        )}
      </Section>
    </>
  );
}

function Outcome({ result, version }: { result: Moment; version: number }) {
  const won = result.won ?? 0;
  const lines = won ? TAVERN.win : TAVERN.lose;
  return (
    <p className={`outcome ${won ? "outcome--win" : "outcome--lose"}`} role="status">
      <b>{won ? `You win ${fmt(won)}!` : `You lose ${fmt(result.stake ?? 0)}.`}</b> {lines[version % lines.length]}
    </p>
  );
}

function Shells({ result, disabled, onPick }: { result?: Moment; disabled: boolean; onPick: (pick: number) => void }) {
  const game = TAVERN.games.shells;
  return (
    <article className="game">
      <h4 className="game__name">{game.name}</h4>
      <p className="game__rules">{game.rules}</p>
      <div className="shells">
        {[1, 2, 3].map((n) => {
          const revealed = !!result;
          const pearlHere = revealed && result?.pearl === n;
          const picked = revealed && result?.pick === n;
          return (
            <button
              key={n}
              className={`shell ${revealed ? "is-lifted" : ""} ${picked ? "is-picked" : ""}`}
              disabled={disabled}
              onClick={() => onPick(n)}
              aria-label={`Shell ${n}`}
            >
              <span className="shell__cup" />
              {pearlHere && <span className="shell__pearl" />}
            </button>
          );
        })}
      </div>
      <p className="game__odds">{game.odds}</p>
    </article>
  );
}

function Wheel({ result, disabled, onSpin }: { result?: Moment; disabled: boolean; onSpin: () => void }) {
  const game = TAVERN.games.wheel;
  const [turn, setTurn] = useState(0);
  const seen = useRef<Moment | undefined>(undefined);
  // Spin forward and stop with the winning slice under the pointer (at the top).
  useEffect(() => {
    if (!result || seen.current === result) return;
    seen.current = result;
    const slice = SLICES.find((s) => s.multiple === (result.multiple ?? 0)) ?? SLICES[0];
    const landing = slice.from + (slice.to - slice.from) * (0.25 + ((result.stake ?? 0) % 7) / 14);
    setTurn((t) => t - (t % 360) + 360 * 4 + (360 - landing));
  }, [result]);
  return (
    <article className="game">
      <h4 className="game__name">{game.name}</h4>
      <p className="game__rules">{game.rules}</p>
      <div className="wheel">
        <span className="wheel__pointer" aria-hidden="true" />
        <span className="wheel__disc" style={{ background: WHEEL_BG, transform: `rotate(${turn}deg)` }} />
        <button className="button wheel__spin" disabled={disabled} onClick={onSpin}>
          Spin
        </button>
      </div>
      <ul className="wheel__legend">
        {WHEEL.map((s) => (
          <li key={s.label}>
            <i style={{ background: s.color }} /> {s.label} · {Math.round(s.share * 100)}%
          </li>
        ))}
      </ul>
      <p className="game__odds">{game.odds}</p>
    </article>
  );
}

