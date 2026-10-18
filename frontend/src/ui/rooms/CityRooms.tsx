import { MARO_QUESTIONS, type MaroQuestion } from "../copy";
import { ActButton, CoinForm, Facts, Section, view, type RoomProps } from "./kit";
import { fmt, loanOf } from "../view";

/** Sefa's Guild Hall: where the tides go. A shift pays; resting or ending the season lets them pass. */
export function GuildRoom({ room }: { room: RoomProps }) {
  const { state } = room.run;
  const v = view(room.run);
  const wage = v.wage;
  const pay = wage ? (wage.min === wage.max ? fmt(wage.min) : `${fmt(wage.min)}–${fmt(wage.max)}`) : "";
  if (v.phase === "final_call") {
    return <p className="room__note">The tides are spent. The last ship is calling at the Harbor.</p>;
  }
  return (
    <>
      <Section title="A shift of work" aside={<span className="tag tag--tide">1 tide</span>}>
        <Facts rows={[["Pay", <b className="num">{pay}</b>], ["Tides left this season", state.tides]]} />
        <div className="room__actions">
          <ActButton room={room} kind="work" label="Work a shift" disabledReason={state.tides < 1 && "No tides left"} />
        </div>
      </Section>
      <Section title="Let time pass">
        <p className="room__note">
          A season ends when its tides run out. Then voyages land, the household eats, bills come due and the next season
          opens.
        </p>
        <div className="room__actions">
          <ActButton room={room} kind="rest" label="Rest a tide" quiet />
          <ActButton room={room} kind="end_season" label={`End ${state.season}`} quiet />
        </div>
      </Section>
    </>
  );
}

/** Grin at the Black Reef: coin now, half again by next season. No Standing check. */
export function ReefRoom({ room }: { room: RoomProps }) {
  const { state } = room.run;
  const v = view(room.run);
  const owed = loanOf(v, "black_reef")?.balance ?? 0;
  const max = (v.limits?.black_reef_max ?? 30000) - owed;
  return (
    <>
      <Section title="An advance">
        <Facts rows={[["You owe Grin", <b className="num">{fmt(owed)}</b>], ["Grin's fee", "Half again, every season"]]} />
        <table className="fee-table" aria-label="What a Black Reef advance grows to">
          <thead>
            <tr>
              <th>Borrow</th>
              <th>Next season</th>
              <th>In two</th>
              <th>In three</th>
            </tr>
          </thead>
          <tbody>
            {[50, 100, 300].map((amount) => (
              <tr key={amount}>
                <td>{amount}◈</td>
                {[1, 2, 3].map((n) => (
                  <td key={n} className="loss">
                    {Math.round(amount * 1.5 ** n)}◈
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <CoinForm room={room} kind="borrow_black_reef" label={`Borrow up to ${fmt(max)}`} verb="Borrow" max={max} />
        <CoinForm room={room} kind="repay_black_reef" label="Pay Grin back" verb="Repay" max={Math.min(owed, state.purse)} />
      </Section>
      <p className="room__note">Nobody boards the last ship owing the Black Reef.</p>
    </>
  );
}

/** What Old Maro asks you to think about: questions, never answers (he doesn't choose for you). */
function maroAsks(room: RoomProps): string[] {
  const { state } = room.run;
  const v = view(room.run);
  const coin = state.purse + (state.vault ?? 0);
  const holds: Record<MaroQuestion["when"], boolean> = {
    debt: state.debt > 0,
    card: (v.card?.balance ?? 0) > 0,
    no_savings: !state.vault,
    behind: !state.passage && coin < (v.passage_price ?? 0),
    idle_coin: state.purse > 40000 && !state.vault,
    low_kelp: (v.stores?.kelp ?? 0) < 20 && (v.season_index ?? 0) >= 1,
    passage: state.passage,
    always: true,
  };
  return MARO_QUESTIONS.filter((q) => holds[q.when]).slice(0, 2).map((q) => q.q);
}

/** Old Maro's lending circle: the Caretaker's pot, paid back a hundred a season, and his questions. */
export function CircleRoom({ room }: { room: RoomProps }) {
  const { state } = room.run;
  const v = view(room.run);
  const owed = loanOf(v, "circle")?.balance;
  return (
    <>
      {owed !== undefined ? (
        <Section title="Your circle">
          <Facts
            rows={[
              ["Still owed to the circle", <b className="num">{fmt(owed)}</b>],
              ["Due by this season's end", fmt(v.circle_due ?? 0)],
            ]}
          />
          <p className="room__note">Payments come from your Purse at each season's end. Miss one and the circle remembers.</p>
          <CoinForm room={room} kind="pay_circle" label="Pay ahead" verb="Pay" max={Math.min(owed, state.purse)} />
        </Section>
      ) : (
        <Section title="Your circle">
          <p className="room__note">You're not in a circle this year, or yours is settled. Old Maro nods as you pass.</p>
        </Section>
      )}
      <Section title="Old Maro asks">
        <ul className="maro">
          {maroAsks(room).map((q) => (
            <li key={q}>“{q}”</li>
          ))}
        </ul>
        <p className="room__note">Old Maro never tells you what to do. He just asks the questions.</p>
      </Section>
    </>
  );
}

/** Herald Kaito at the Council of Ten: the official word, always true. */
export function CouncilRoom({ room }: { room: RoomProps }) {
  const { state } = room.run;
  const v = view(room.run);
  const official = room.run.events.filter((line) => /began|debased|Council|Passage costs|last ship/.test(line)).slice(-4);
  return (
    <>
      <Section title="The Council's word">
        <Facts
          rows={[
            ["Season", state.season],
            ["Passage on the last ship", <b className="num">{fmt(v.passage_price ?? 0)}</b>],
            ["Vault rate", `${((v.vault_rate ?? 0) * 100).toFixed(0)}% a season`],
          ]}
        />
        {official.length > 0 && (
          <ul className="news-list">
            {official.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </Section>
      <p className="room__note">The Council sets the tithe and the Vault rate, and can debase the coin.</p>
      <ActButton room={room} kind="pay_tithe" label="Pay the tithe now" quiet />
    </>
  );
}
