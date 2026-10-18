import { useEffect, type ReactNode } from "react";
import type { Ledger } from "../types";
import { fmt } from "./view";

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="room-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="panel drawer" role="dialog" aria-label={title}>
        <header className="room__head">
          <h2 className="room__title">{title}</h2>
          <button className="room__close" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="room__body">{children}</div>
      </aside>
    </div>
  );
}

const STATUS: Record<string, string> = {
  pending: "Waiting",
  sending: "Sending",
  confirmed: "On Nessie",
  needs_review: "Check",
  failed: "Failed",
};

/** "grand_market" -> "Grand market"; ordinary sentences are left alone. */
const label = (reason: string) => {
  const text = reason.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Every coin movement and where it stands on Nessie, Capital One's banking API. */
export function LedgerDrawer({ ledger, onClose }: { ledger: Ledger | null; onClose: () => void }) {
  const entries = ledger ? [...ledger.entries].reverse() : [];
  const confirmed = entries.filter((e) => e.status === "confirmed").length;
  return (
    <Drawer title="The Ledger" onClose={onClose}>
      {!ledger ? (
        <p className="room__note">Reading the ledger…</p>
      ) : (
        <>
          <p className="room__note">
            {ledger.live
              ? `Every coin you move is recorded on Nessie. ${confirmed} of ${entries.length} records confirmed.`
              : "Nessie isn't connected, so records wait here to be sent."}
          </p>
          {Object.entries(ledger.balances).map(([name, b]) => (
            <p key={name} className="ledger__check">
              <b>{name === "purse" ? "Purse" : "Vault"}</b> {fmt(b.expected)} here ·{" "}
              {b.remote === null ? "Nessie check pending" : `${fmt(b.remote)} on Nessie ${b.matches ? "✓ matches" : "✗ differs"}`}
            </p>
          ))}
          <ol className="ledger">
            {entries.map((e) => (
              <li key={e.seq} className={`ledger__row ledger__row--${e.status}`}>
                <span className="ledger__reason">{label(e.body.reason)}</span>
                <span className="ledger__amount num">{e.body.amount ? fmt(e.body.amount) : ""}</span>
                <span className="ledger__kind">{e.body.kind.replace("_", " ")}</span>
                <span className={`ledger__status ledger__status--${e.status}`}>{STATUS[e.status] ?? e.status}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </Drawer>
  );
}
