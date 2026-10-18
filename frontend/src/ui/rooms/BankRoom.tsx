import { CoinForm, Facts, Section, can, view, type RoomProps } from "./kit";
import { fmt, loanOf } from "../view";

const BILL_NAMES: Record<string, string> = { tithe: "Council tithe", care: "Care bill", repair: "Roof repair" };

/** Ione's counter: Purse and Vault, Leviathan Credit, loans, bills, Standing. Nothing here costs a tide. */
export function BankRoom({ room }: { room: RoomProps }) {
  const { state } = room.run;
  const v = view(room.run);
  const card = v.card;
  const guild = loanOf(v, "guild");
  const bills = v.bills ?? [];
  const locked = v.vault_locked ?? 0;
  const freeVault = (state.vault ?? 0) - locked;
  const factors = v.standing_factors ?? {};
  const sign = (n?: number) => (n === undefined ? "–" : n > 0 ? `+${n}` : String(n));

  return (
    <>
      <Section title="Purse and Vault">
        <Facts
          rows={[
            ["Purse", <b className="num">{fmt(state.purse)}</b>],
            ["Vault", state.vault === null ? "Not open" : <b className="num">{fmt(state.vault)}</b>],
            locked > 0 && ["Locked for your card", fmt(locked)],
            state.vault !== null && ["Vault interest", `${((v.vault_rate ?? 0) * 100).toFixed(0)}% a season`],
          ]}
        />
        <p className="room__note">The Purse spends and can be stolen. The Vault earns a little and is safe from thieves.</p>
        <div className="room__actions">
          {can(room.run, "open_vault") && (
            <button className="button" disabled={room.busy} onClick={() => void room.act({ kind: "open_vault" })}>
              Open a Vault
            </button>
          )}
          {can(room.run, "open_vault") && (v.limits?.vault_min_standing ?? 0) > 0 && (
            <span className="room__note">Ione opens a Vault for you at Standing {v.limits?.vault_min_standing}.</span>
          )}
        </div>
        <CoinForm room={room} kind="save" label="Move coin into the Vault" verb="Save" max={state.purse} />
        <CoinForm room={room} kind="withdraw" label="Take coin out of the Vault" verb="Withdraw" max={freeVault} />
      </Section>

      <Section title="Leviathan Credit">
        {card ? (
          <>
            <Facts
              rows={[
                ["Owed", <b className="num">{fmt(card.balance)}</b>],
                ["Limit", fmt(card.limit)],
                card.min_due > 0 && ["Minimum due this season", fmt(card.min_due)],
                card.frozen && ["Status", "Frozen: your Standing is too low"],
              ]}
            />
            <p className="room__note">7.5% a season on what you owe. Miss the minimum and pay a fee and lose Standing.</p>
            <CoinForm room={room} kind="repay_credit" label="Pay down the card" verb="Pay" max={Math.min(card.balance, state.purse)} />
          </>
        ) : can(room.run, "open_secured_card") ? (
          <>
            <p className="room__note">
              Without Standing the Bank won't lend. Lock {fmt(v.limits?.secured_deposit ?? 20000)} in a Vault and Ione issues a
              starter card, and your Standing begins.
            </p>
            <button className="button" disabled={room.busy} onClick={() => void room.act({ kind: "open_secured_card" })}>
              Open a secured card
            </button>
          </>
        ) : (
          <p className="room__note">No card.</p>
        )}
      </Section>

      {(guild || bills.length > 0) && (
        <Section title="What you owe">
          {guild && (
            <>
              <Facts rows={[["Guild loan", <b className="num">{fmt(guild.balance)}</b>], ["Interest", "1% a season"]]} />
              <CoinForm room={room} kind="repay_guild" label="Repay the guild" verb="Repay" max={Math.min(guild.balance, state.purse)} />
            </>
          )}
          {bills.length > 0 && (
            <>
              <ul className="bills">
                {bills.map((b) => (
                  <li key={b.id}>
                    <span>{BILL_NAMES[b.kind] ?? b.kind}</span>
                    {b.late && <span className="tag tag--late">Late</span>}
                    <b className="num">{fmt(b.amount)}</b>
                  </li>
                ))}
              </ul>
              <p className="room__note">Bills pay themselves from the Purse at season's end, if the Purse can cover them.</p>
              {can(room.run, "pay_bills") && (
                <button className="button" disabled={room.busy} onClick={() => void room.act({ kind: "pay_bills" })}>
                  Pay all bills now
                </button>
              )}
            </>
          )}
        </Section>
      )}

      <Section title="Standing" aside={<b className="num">{state.standing ?? "Unrated"}</b>}>
        {state.standing === null ? (
          <p className="room__note">You have no history with the Bank yet.</p>
        ) : (
          <>
            <Facts
              rows={[
                ["On-time payments", sign(factors.payments)],
                ["Credit used", sign(factors.credit_used)],
                ["History", sign(factors.history)],
              ]}
            />
            <p className="room__note">Last season's change, by factor. Paying on time matters most.</p>
          </>
        )}
      </Section>
    </>
  );
}
