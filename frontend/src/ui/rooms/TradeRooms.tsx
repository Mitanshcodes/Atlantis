import { ActButton, Basket, Facts, Section, ShockBanner, can, view, type RoomProps } from "./kit";
import { GOODS, HOUSES, HOUSE_NOTES } from "../copy";
import { fmt } from "../view";

const STORMS = ["Calm seas", "Storm risk", "Heavy storms", "Treacherous seas"];

/** The Grand Market: kelp and pearls in one basket. One trip a season is free. */
export function MarketRoom({ room }: { room: RoomProps }) {
  const v = view(room.run);
  const prices = v.prices?.goods ?? {};
  const stores = v.stores ?? {};
  const cellar = v.limits?.cellar ?? 60;
  return (
    <>
      <ShockBanner run={room.run} />
      <Section title="Today's prices">
        <Basket
          room={room}
          kind="market_visit"
          unit="Good"
          capacity={{ kelp: cellar }}
          lots={Object.keys(prices).map((id) => ({
            id,
            name: GOODS[id]?.name ?? id,
            note: GOODS[id]?.note,
            price: prices[id],
            held: stores[id] ?? 0,
          }))}
        />
      </Section>
      <Section title="Your cellar">
        <Facts
          rows={[
            ["Kelp stored", `${stores.kelp ?? 0} of ${cellar}`],
            ["Your household eats", `${v.limits?.kelp_per_season ?? 20} a season`],
          ]}
        />
        <p className="room__note">Stored kelp spoils a little each season. Whatever you lack is bought at that season's price.</p>
      </Section>
    </>
  );
}

/** The Harbor Exchange: shares in the shipping houses, and Passage on the last ship. */
export function ExchangeRoom({ room }: { room: RoomProps }) {
  const { state } = room.run;
  const v = view(room.run);
  const prices = v.prices?.houses ?? {};
  const shares = v.shares ?? {};
  const records = v.house_records ?? {};
  const price = v.passage_price ?? 0;
  const reason =
    state.debt > 0
      ? `Settle every debt first (${fmt(state.debt)})`
      : state.purse < price
        ? `Passage is paid from the Purse: you need ${fmt(price - state.purse)} more there`
        : false;
  return (
    <>
      <ShockBanner run={room.run} />
      <Section title="Shipping houses" aside={<span className="tag tag--tide">{STORMS[v.storm_level ?? 0]}</span>}>
        <Basket
          room={room}
          kind="exchange_visit"
          unit="House"
          lots={Object.keys(prices).map((id) => ({
            id,
            name: HOUSES[id] ?? id,
            note: HOUSE_NOTES[id],
            price: prices[id],
            held: shares[id] ?? 0,
            extra: records[id]?.length ? (
              <span className="voyages" aria-label="Last voyages">
                {records[id].map((ok, i) => (
                  <i key={i} className={ok ? "voyage voyage--ok" : "voyage voyage--lost"} />
                ))}
              </span>
            ) : undefined,
          }))}
        />
        <p className="room__note">Voyages land at each season's end. The houses don't sail in the Long Dark.</p>
      </Section>
      <Section title="Passage on the last ship" aside={<b className="num">{fmt(price)}</b>}>
        {state.passage ? (
          <p className="room__note">Your place aboard is paid. Keep your coin safe until the ship sails.</p>
        ) : (
          <>
            <p className="room__note">Paid in coin, with no debt of any kind. The price rises every season.</p>
            <div className="room__actions">
              <ActButton room={room} kind="buy_passage" label={`Buy Passage · ${fmt(price)}`} disabledReason={reason} />
              {reason && <span className="room__note">{reason}.</span>}
            </div>
          </>
        )}
      </Section>
      {!can(room.run, "exchange_visit") && <p className="room__note">The Exchange is closed.</p>}
    </>
  );
}
