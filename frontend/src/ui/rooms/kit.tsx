/**
 * The pieces every building's room is made of: the room's frame and the controls that send
 * actions to the engine. Rooms never decide what's allowed; they offer what ``available_actions``
 * lists and show the engine's answer. Amounts are typed in whole coins and sent in hundredths.
 */

import { useEffect, useId, useState, type ReactNode } from "react";
import type { Building } from "../../game/buildings";
import type { ActionInput } from "../../store";
import type { Order, Run } from "../../types";
import { BUILDING_INFO, ROOM_MIRROR, SHOCKS } from "../copy";
import { MirrorButton } from "../Mirror";
import { coins, fmt, toMinor, viewOf, type GameView } from "../view";

export interface RoomProps {
  run: Run;
  busy: boolean;
  act: (input: ActionInput) => Promise<void>;
}

export const can = (run: Run, kind: string) =>
  run.state.available_actions.includes(kind);
export const view = (run: Run): GameView => viewOf(run.state);

export function Room({
  building,
  onLeave,
  children,
  tide,
}: {
  building: Building;
  onLeave: () => void;
  children: ReactNode;
  /** A line about what a visit here costs in tides. */
  tide?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onLeave();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLeave]);
  const titleId = useId();
  return (
    <div
      className="room-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onLeave()}
    >
      <section className="panel room" role="dialog" aria-labelledby={titleId}>
        <header className="room__head">
          <div>
            <p className="room__keeper">{building.keeper}</p>
            <h2 id={titleId} className="room__title">
              {building.name}
            </h2>
          </div>
          <button
            className="room__close"
            onClick={onLeave}
            aria-label={`Leave ${building.name}`}
          >
            Leave
          </button>
        </header>
        <div className="room__body">
          <div className="room__intro">
            <MirrorButton
              title={building.name}
              entries={ROOM_MIRROR[building.id] ?? []}
            />
            <HowItWorks building={building} tide={tide} />
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}

/** What a visit costs, and the plain rules of the place (the tour's words) folded away. */
function HowItWorks({
  building,
  tide,
}: {
  building: Building;
  tide?: ReactNode;
}) {
  const info = BUILDING_INFO[building.id];
  if (!info) return null;
  return (
    <details className="room-how">
      <summary>
        <span>How this place works</span>
        <span className="room-how__cost">{tide ?? info.cost}</span>
      </summary>
      <p className="room-how__about">{info.about}</p>
      <ul className="room-how__list">
        {info.do.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </details>
  );
}

/** This season's market shock, if it has hit: what happened and what it means for prices. */
export function ShockBanner({ run }: { run: Run }) {
  const id = view(run).shock;
  const words = id ? SHOCKS[id] : undefined;
  if (!words) return null;
  return (
    <aside className="shock-banner" role="note">
      <p className="shock-banner__eyebrow">Market news this season</p>
      <p className="shock-banner__title">{words.title}</p>
      <p className="shock-banner__means">{words.means}</p>
    </aside>
  );
}

export function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="room__section">
      <header className="room__section-head">
        <h3>{title}</h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function Facts({
  rows,
}: {
  rows: Array<[string, ReactNode] | false | null | undefined>;
}) {
  return (
    <dl className="facts">
      {rows.filter(Boolean).map((row) => {
        const [label, value] = row as [string, ReactNode];
        return (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

export function ActButton({
  room,
  kind,
  label,
  input,
  quiet,
  disabledReason,
}: {
  room: RoomProps;
  kind: string;
  label: ReactNode;
  input?: Omit<ActionInput, "kind">;
  quiet?: boolean;
  /** Shown instead of acting when the engine would refuse anyway. */
  disabledReason?: string | false;
}) {
  if (!can(room.run, kind)) return null;
  return (
    <button
      className={quiet ? "button button--quiet" : "button"}
      disabled={room.busy || !!disabledReason}
      title={disabledReason || undefined}
      onClick={() => void room.act({ kind, ...input })}
    >
      {label}
    </button>
  );
}

/** Type a whole-coin amount and send it. ``max`` (hundredths) adds a "Max" shortcut. */
export function CoinForm({
  room,
  kind,
  label,
  verb,
  max,
  target,
}: {
  room: RoomProps;
  kind: string;
  label: string;
  verb: string;
  max?: number;
  target?: string;
}) {
  const [value, setValue] = useState("");
  const id = useId();
  if (!can(room.run, kind)) return null;
  const amount = Number(value);
  const valid = /^\d+$/.test(value) && amount > 0;
  const submit = () => {
    if (!valid) return;
    void room
      .act({ kind, amount: toMinor(amount), target })
      .then(() => setValue(""));
  };
  return (
    <form
      className="coin-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="coin-form__row">
        <input
          id={id}
          inputMode="numeric"
          placeholder="◈"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
          disabled={room.busy}
        />
        {max !== undefined && max > 0 && (
          <button
            type="button"
            className="button button--quiet"
            disabled={room.busy}
            onClick={() => setValue(String(coins(max)))}
          >
            Max
          </button>
        )}
        <button className="button" disabled={room.busy || !valid}>
          {verb}
        </button>
      </div>
    </form>
  );
}

export interface Lot {
  id: string;
  name: string;
  note?: string;
  price: number; // hundredths, per unit, right now
  held: number;
  extra?: ReactNode;
}

/**
 * Buy and sell several things in one visit. Shows a rough total (each unit traded nudges the
 * price, so the engine's figure can differ slightly) and sends one basket action.
 */
export function Basket({
  room,
  kind,
  lots,
  unit,
  capacity,
}: {
  room: RoomProps;
  kind: "market_visit" | "exchange_visit";
  lots: Lot[];
  unit: string;
  /** Optional cap on holding one lot (the cellar holds 60 kelp). */
  capacity?: Record<string, number>;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const set = (id: string, n: number) => setQty((q) => ({ ...q, [id]: n }));
  const orders: Order[] = lots
    .filter((l) => (qty[l.id] ?? 0) !== 0)
    .map((l) => ({
      side: qty[l.id] > 0 ? "buy" : "sell",
      target: l.id,
      quantity: Math.abs(qty[l.id]),
    }));
  const total = lots.reduce((sum, l) => sum + (qty[l.id] ?? 0) * l.price, 0);
  const enabled = can(room.run, kind);
  return (
    <div className="basket">
      <table className="basket__table">
        <thead>
          <tr>
            <th>{unit}</th>
            <th>Price</th>
            <th>Held</th>
            <th>This visit</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot) => {
            const n = qty[lot.id] ?? 0;
            const cap = capacity?.[lot.id];
            return (
              <tr key={lot.id}>
                <th scope="row">
                  <span className="basket__name">{lot.name}</span>
                  {lot.note && <span className="basket__note">{lot.note}</span>}
                  {lot.extra}
                </th>
                <td className="num">{fmt(lot.price)}</td>
                <td>{lot.held}</td>
                <td>
                  <div className="stepper">
                    <button
                      type="button"
                      disabled={!enabled || room.busy || lot.held + n <= 0}
                      onClick={() => set(lot.id, n - stepOf(lot, n, -1))}
                      aria-label={`Sell ${lot.name}`}
                    >
                      −
                    </button>
                    <output
                      className={n > 0 ? "is-buy" : n < 0 ? "is-sell" : ""}
                    >
                      {n > 0 ? `+${n}` : n}
                    </output>
                    <button
                      type="button"
                      disabled={
                        !enabled ||
                        room.busy ||
                        (cap !== undefined && lot.held + n >= cap)
                      }
                      onClick={() => set(lot.id, n + stepOf(lot, n, 1))}
                      aria-label={`Buy ${lot.name}`}
                    >
                      +
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <footer className="basket__foot">
        <span>
          {total > 0
            ? "You pay about "
            : total < 0
              ? "You receive about "
              : "Nothing chosen"}
          {total !== 0 && <b className="num">{fmt(Math.abs(total))}</b>}
        </span>
        <span className="basket__actions">
          <button
            className="button button--quiet"
            disabled={room.busy || !orders.length}
            onClick={() => setQty({})}
          >
            Clear
          </button>
          <button
            className="button"
            disabled={!enabled || room.busy || !orders.length}
            onClick={() =>
              void room.act({ kind, orders }).then(() => setQty({}))
            }
          >
            Trade
          </button>
        </span>
      </footer>
    </div>
  );
}

/** Steps of 1, or 5 once you've already moved 5 (quick for big orders), never past what's held. */
function stepOf(lot: Lot, n: number, dir: 1 | -1): number {
  const step = Math.abs(n) >= 5 ? 5 : 1;
  return dir < 0 && lot.held + n - step < 0 ? 1 : step;
}
