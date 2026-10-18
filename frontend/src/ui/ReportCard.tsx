import { useEffect, useState } from "react";
import { api } from "../api";
import { loadProfile } from "../game/profile";
import type { Run } from "../types";
import { SHOCKS } from "./copy";
import { MirrorButton } from "./Mirror";
import { Chelo } from "./opening/art";
import { coin, pct, type SeasonReport } from "./report";
import { fmt, viewOf } from "./view";

interface Props {
  run: Run;
  /** The season that just ended. */
  season: string;
  onDone: () => void;
}

/**
 * At each season's end, a report card on a scroll: how close you are to Passage, marks for how
 * you used your tides and coin, where the coin went, how your shares did, a note from Chelo, and
 * the Modern Mirror. The engine works out every number; Chelo's bullets are the only AI-written part.
 */
export function ReportCard({ run, season, onDone }: Props) {
  const [report, setReport] = useState<SeasonReport | null>(null);
  const [missing, setMissing] = useState(false);
  const [note, setNote] = useState<string[] | null>(null);
  useEffect(() => {
    let live = true;
    api
      .report(run.run_id, season)
      .then((r) => live && setReport(r))
      .catch(() => live && setMissing(true));
    api
      .reportNote(run.run_id, season)
      .then((n) => live && setNote(n.bullets))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [run.run_id, season]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  const name = loadProfile()?.name;
  const passage = viewOf(run.state).passage_price ?? 0;
  return (
    <div className="card-backdrop report-backdrop">
      <section
        className="scroll-sheet report"
        role="dialog"
        aria-labelledby="report-title"
      >
        <span
          className="scroll-sheet__roller scroll-sheet__roller--top"
          aria-hidden="true"
        />
        <div className="scroll-sheet__paper report__paper">
          <span className="scroll-sheet__seal" aria-hidden="true" />
          <div className="report__scroll">
            <p className="scroll-sheet__eyebrow">
              Season report{name ? ` · ${name}` : ""}
            </p>
            <h2 id="report-title" className="scroll-sheet__title">
              The {season}
            </h2>
            <p className="scroll-sheet__divider" aria-hidden="true">
              ✦
            </p>

            {!report && !missing && (
              <p className="report__wait">Chelo is reading your ledgers…</p>
            )}
            {missing && (
              <p className="report__wait">
                No report was kept for this season.
              </p>
            )}
            {report && (
              <>
                <Pace report={report} />
                <CheloSays bullets={note ?? report.chelo} />
                <Marks report={report} />
                <Tides report={report} />
                <Coin report={report} />
                <Shares report={report} />
                <MirrorButton
                  title={`The ${season}, in the real world`}
                  hint="What this season teaches"
                  entries={report.mirror.map((m) => ({
                    here: m.name,
                    text: m.text,
                  }))}
                />
              </>
            )}

            <footer className="report__foot">
              <span>
                {run.state.season} begins. Passage now costs{" "}
                <b className="num">{fmt(passage)}</b>
              </span>
              <button className="pixel-button" onClick={onDone} autoFocus>
                Into the {run.state.season} ▶
              </button>
            </footer>
          </div>
        </div>
        <span
          className="scroll-sheet__roller scroll-sheet__roller--bottom"
          aria-hidden="true"
        />
      </section>
    </div>
  );
}

function Section({
  title,
  children,
  note,
}: {
  title: string;
  children: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <section className="report__section">
      <h3 className="report__heading">
        {title}
        {note && <span className="report__heading-note">{note}</span>}
      </h3>
      {children}
    </section>
  );
}

/** The headline: what you're worth against next season's Passage, and where you'd want to be. */
function Pace({ report }: { report: SeasonReport }) {
  const { pace, target } = report;
  const share = Math.round(pace.worth_share * 100);
  const gained = pace.net_worth_end - pace.net_worth_start;
  return (
    <section className="report__pace" aria-label="On course for Passage">
      <div className="report__pace-row">
        <span className="report__pace-big num">{share}%</span>
        <span className="report__pace-words">
          <b>of next season's Passage</b> ({coin(pace.passage_next)})
          <span className="report__pace-sub">
            Worth {coin(pace.net_worth_end)} · {gained >= 0 ? "up" : "down"}{" "}
            {coin(Math.abs(gained))} this season
          </span>
        </span>
      </div>
      <div
        className="report__bar"
        role="img"
        aria-label={`${share}% of Passage; on course is ${target}%`}
      >
        <span
          className="report__bar-fill"
          style={{ width: `${Math.min(100, share)}%` }}
        />
        <span className="report__bar-target" style={{ left: `${target}%` }}>
          <i>on course: {target}%</i>
        </span>
      </div>
      <p className="report__small">
        Worth: everything you own at today's prices, minus debts.
      </p>
    </section>
  );
}

function Marks({ report }: { report: SeasonReport }) {
  return (
    <Section title="Marks">
      <ul className="report__marks">
        {report.marks.map((m) => (
          <li key={m.subject}>
            <span
              className={`report__stamp report__stamp--${m.grade}`}
              aria-label={`Grade ${m.grade}`}
            >
              {m.grade}
            </span>
            <span>
              <b className="report__mark-label">{m.label}</b>
              <span className="report__mark-text">{m.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Each tide as a box, coloured by what it went on. */
function Tides({ report }: { report: SeasonReport }) {
  const { tides } = report;
  const boxes = tides.uses.flatMap((u) =>
    Array.from({ length: u.count }, (_, i) => ({ ...u, key: `${u.use}${i}` })),
  );
  return (
    <Section
      title="Your tides"
      note={
        tides.free_trips
          ? `plus ${tides.free_trips} free ${tides.free_trips === 1 ? "visit" : "visits"}`
          : undefined
      }
    >
      <div className="report__tides">
        {boxes.map((b) => (
          <span
            key={b.key}
            className={`report__tide report__tide--${b.use}`}
            title={b.label}
          />
        ))}
      </div>
      <ul className="report__legend">
        {tides.uses.map((u) => (
          <li key={u.use}>
            <span
              className={`report__tide report__tide--${u.use}`}
              aria-hidden="true"
            />
            {u.label} {u.count}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Coin({ report }: { report: SeasonReport }) {
  const m = report.money;
  const net = m.total_in - m.total_out;
  const moves = [
    m.saved > 0 && `Moved ${coin(m.saved)} into the Vault`,
    m.saved < 0 && `Took ${coin(-m.saved)} out of the Vault`,
    m.debt_paid > 0 && `Paid ${coin(m.debt_paid)} off debts`,
    m.borrowed > 0 && `Borrowed ${coin(m.borrowed)}`,
  ].filter(Boolean) as string[];
  return (
    <Section
      title="Your coin"
      note={`${net >= 0 ? "+" : "−"}${coin(Math.abs(net))} overall`}
    >
      <div className="report__money">
        <Ledger title="Came in" lines={m.in} total={m.total_in} sign="+" />
        <Ledger title="Went out" lines={m.out} total={m.total_out} sign="−" />
      </div>
      {moves.length > 0 && <p className="report__small">{moves.join(" · ")}</p>}
    </Section>
  );
}

function Ledger({
  title,
  lines,
  total,
  sign,
}: {
  title: string;
  lines: SeasonReport["money"]["in"];
  total: number;
  sign: string;
}) {
  return (
    <div className="report__ledger">
      <p className="report__ledger-title">{title}</p>
      {lines.length ? (
        <dl>
          {lines.map((l) => (
            <div key={l.category}>
              <dt>{l.label}</dt>
              <dd className="num">
                {sign}
                {coin(l.amount)}
              </dd>
            </div>
          ))}
          <div className="report__ledger-total">
            <dt>Total</dt>
            <dd className="num">
              {sign}
              {coin(total)}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="report__small">Nothing.</p>
      )}
    </div>
  );
}

function Shares({ report }: { report: SeasonReport }) {
  const inv = report.investments;
  const index = inv.index_change;
  const shock = report.shock ? SHOCKS[report.shock]?.title : undefined;
  return (
    <Section
      title="Your investments"
      note={shock ? `Market news: ${shock}` : undefined}
    >
      {inv.rows.length ? (
        <table className="report__shares">
          <thead>
            <tr>
              <th>House</th>
              <th>Shares</th>
              <th>Worth</th>
              <th>Price</th>
              <th>Voyage</th>
            </tr>
          </thead>
          <tbody>
            {inv.rows.map((r) => (
              <tr key={r.house}>
                <th scope="row">{r.name}</th>
                <td>{r.shares}</td>
                <td className="num">{coin(r.value)}</td>
                <td className={r.change >= 0 ? "report__up" : "report__down"}>
                  {pct(r.change)}
                </td>
                <td>
                  {r.voyage === null ? "·" : r.voyage ? "Landed" : "Lost"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="report__small">You held no shares this season.</p>
      )}
      <p className="report__small">
        {index !== null && <>The Tide Index moved {pct(index)} this season. </>}
        {inv.dividends > 0 && <>Dividends paid you {coin(inv.dividends)}. </>}
        {inv.pearls && (
          <>
            Your {inv.pearls.qty} pearls are worth {coin(inv.pearls.value)} (you
            paid {coin(inv.pearls.paid)}).
          </>
        )}
      </p>
    </Section>
  );
}

/** Chelo's feedback: a few short bullets, appearing one by one. */
function CheloSays({ bullets }: { bullets: string[] }) {
  return (
    <aside className="report__chelo">
      <Chelo scale={4} />
      <div>
        <p className="report__chelo-name">Chelo says</p>
        <ul className="report__chelo-list" key={bullets.join("|")}>
          {bullets.map((b, i) => (
            <li key={b} style={{ animationDelay: `${0.2 + i * 0.45}s` }}>
              {b}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
