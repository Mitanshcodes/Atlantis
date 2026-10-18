import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BUILDINGS_BY_ID, type BuildingId } from "./game/buildings";
import { EventBus } from "./game/EventBus";
import { PhaserGame } from "./game/PhaserGame";
import { useBanking } from "./store";
import { BuildingCard } from "./ui/BuildingCard";
import { Chronicle } from "./ui/Chronicle";
import { ClassSelect } from "./ui/ClassSelect";
import { DEMO_RUN } from "./ui/demoRun";
import { Dialogue } from "./ui/Dialogue";
import { LedgerDrawer } from "./ui/Drawers";
import { Ending, FinalCall } from "./ui/Ending";
import { EventCard } from "./ui/EventCard";
import { Hud } from "./ui/Hud";
import { BuildingRoom } from "./ui/rooms";
import { ScrollsDrawer } from "./ui/Scrolls";
import { momentsOf, viewOf, type Moment } from "./ui/view";

interface Hover {
  id: BuildingId;
  anchor: { x: number; y: number };
}

/** What waits to be shown, in the order it happened: cards, and the Chronicle where a season ended. */
type Beat = { type: "card"; moment: Moment } | { type: "chronicle"; season: string };

/** Moments worth stopping the player for. Season ends open the Chronicle instead. */
const CARD_KINDS = new Set(["event", "scroll", "debasement", "clue", "passage_bought", "fraud_lost", "scam_revealed", "card_frozen"]);
/** Entering these tells the engine (the event deck notices who drinks at the tavern or visits Grin). */
const NOTICED: BuildingId[] = ["drowned_bell", "black_reef"];

/** The city with the game layered over it: class select, rooms, event cards, Chronicle, ending. */
export function App() {
  const bank = useBanking();
  const { run, busy, act } = bank;
  const [inside, setInside] = useState<BuildingId | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [drawer, setDrawer] = useState<"ledger" | "scrolls" | null>(null);
  const seen = useRef<{ id: string; version: number } | null>(null);
  // ?demo shows the HUD over a sample run, for layout checks without a backend.
  const demo = useMemo(() => new URLSearchParams(window.location.search).has("demo"), []);
  const shown = run ?? (demo ? DEMO_RUN : null);

  useEffect(
    () =>
      EventBus.on("building-entered", (id) => {
        setInside(id);
        if (run && NOTICED.includes(id) && run.state.available_actions.includes("visit")) {
          void act({ kind: "visit", target: id });
        }
      }),
    [run, act],
  );
  useEffect(
    () => EventBus.on("building-hover", (id, anchor) => setHover(id && anchor ? { id, anchor } : null)),
    [],
  );

  // When a move lands (the run's version goes up), queue what it set off. Reloads show nothing new.
  useEffect(() => {
    if (!run) {
      seen.current = null;
      return;
    }
    const prev = seen.current;
    seen.current = { id: run.run_id, version: run.state.version };
    if (!prev || prev.id !== run.run_id || run.state.version <= prev.version) return;
    // A move that ends a season also opens the next: the old season's cards, then its Chronicle,
    // then whatever the new season opened with (a debasement, a clue).
    const fresh: Beat[] = momentsOf(run.state).flatMap((m): Beat[] =>
      m.kind === "season_end" && m.season
        ? [{ type: "chronicle", season: m.season }]
        : CARD_KINDS.has(m.kind)
          ? [{ type: "card", moment: m }]
          : [],
    );
    if (fresh.length) setBeats((queue) => [...queue, ...fresh]);
  }, [run]);

  // Errors fade after a few seconds.
  useEffect(() => {
    if (!bank.error) return;
    const timer = setTimeout(bank.clearError, 6000);
    return () => clearTimeout(timer);
  }, [bank.error, bank.clearError]);

  const leave = useCallback(() => {
    if (!inside) return;
    EventBus.emit("building-left", inside);
    setInside(null);
  }, [inside]);

  const goTo = (id: BuildingId) => {
    leave();
    EventBus.emit("go-to-building", id);
  };

  const again = () => {
    setBeats([]);
    setDrawer(null);
    leave();
    bank.abandon();
  };

  const view = shown ? viewOf(shown.state) : undefined;
  const freeVisit = (id: BuildingId) =>
    (id === "market" && !!view?.free_visits?.market) || (id === "harbor" && !!view?.free_visits?.exchange);
  const phase = view?.phase;
  const room = run ? { run, busy: busy || !!bank.pending, act } : null;
  const beat = beats[0];
  const card = beat?.type === "card" ? beat.moment : undefined;
  const nextBeat = () => setBeats((queue) => queue.slice(1));

  return (
    <div className="app">
      <PhaserGame />
      {shown && phase !== "ended" && (
        <Hud run={shown} ledger={bank.ledger} onLedger={() => setDrawer("ledger")} onScrolls={() => setDrawer("scrolls")} />
      )}
      {hover && !inside && !card && (
        <BuildingCard building={BUILDINGS_BY_ID[hover.id]} anchor={hover.anchor} freeVisit={freeVisit(hover.id)} />
      )}

      {inside && room && phase !== "ended" && <BuildingRoom building={BUILDINGS_BY_ID[inside]} room={room} onLeave={leave} />}
      {inside && !room && <Dialogue building={BUILDINGS_BY_ID[inside]} onLeave={leave} />}

      {run && card && (
        <EventCard
          key={beats.length + card.kind + card.text}
          moment={card}
          run={run}
          busy={busy}
          act={act}
          onDone={nextBeat}
          onGo={goTo}
        />
      )}
      {run && beat?.type === "chronicle" && <Chronicle run={run} season={beat.season} onDone={nextBeat} />}
      {run && !beat && !inside && phase === "final_call" && (
        <FinalCall run={run} busy={busy} act={act} onBank={() => goTo("bank")} />
      )}
      {run && !beat && phase === "ended" && <Ending run={run} onAgain={again} />}

      {run && drawer === "ledger" && <LedgerDrawer ledger={bank.ledger} onClose={() => setDrawer(null)} />}
      {run && drawer === "scrolls" && <ScrollsDrawer run={run} onClose={() => setDrawer(null)} />}

      {!run && !demo && <ClassSelect busy={busy} error={bank.error} onBegin={(id) => void bank.create(id)} />}

      {bank.pending && (
        <div className="toast toast--info" role="status">
          Your last move hasn't been confirmed.
          <button className="button button--quiet" disabled={busy} onClick={() => void bank.retry()}>
            Retry
          </button>
        </div>
      )}
      {run && bank.error && !bank.pending && (
        <div className="toast" role="alert" onClick={bank.clearError}>
          {bank.error}
        </div>
      )}
    </div>
  );
}
