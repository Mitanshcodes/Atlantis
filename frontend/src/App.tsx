import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BUILDINGS_BY_ID, type BuildingId } from "./game/buildings";
import { EventBus } from "./game/EventBus";
import { NPCS, NPCS_BY_ID, type NpcId } from "./game/npcs";
import { PhaserGame } from "./game/PhaserGame";
import { useBanking } from "./store";
import { BuildingCard } from "./ui/BuildingCard";
import { ReportCard } from "./ui/ReportCard";
import { DEMO_RUN } from "./ui/demoRun";
import { Dialogue } from "./ui/Dialogue";
import { LedgerDrawer } from "./ui/Drawers";
import { Ending, FinalCall } from "./ui/Ending";
import { EventCard } from "./ui/EventCard";
import { Hud } from "./ui/Hud";
import { Opening, type OpeningStep } from "./ui/opening/Opening";
import { BuildingRoom } from "./ui/rooms";
import { ScrollsDrawer } from "./ui/Scrolls";
import { Tour, toured } from "./ui/Tour";
import { momentsOf, viewOf, type Moment } from "./ui/view";
import { NpcDialogue } from "./ui/NpcDialogue";
import { talk, type Choice } from "./ui/npcTalk";
import { useHeard } from "./ui/useHeard";

interface Hover {
  id: BuildingId;
  anchor: { x: number; y: number };
}

/** What waits to be shown, in the order it happened: cards, and the report where a season ended. */
type Beat = { type: "card"; moment: Moment } | { type: "report"; season: string };

/** Moments worth stopping the player for. Season ends open the season report instead. */
const CARD_KINDS = new Set([
  "event",
  "market_shock",
  "scroll",
  "debasement",
  "clue",
  "passage_bought",
  "fraud_lost",
  "scam_revealed",
  "card_frozen",
]);

/** Buildings that are engine Places: walking in is a free Visit, which the event deck notices. */
const PLACES: Partial<Record<BuildingId, string>> = {
  bank: "bank",
  market: "market",
  harbor: "harbor",
  drowned_bell: "drowned_bell",
  black_reef: "black_reef",
};

/** The city with the game layered over it: opening, tour, rooms, townsfolk, event cards, reports, ending. */
export function App() {
  const bank = useBanking();
  const { run, busy, error, act } = bank;
  const [inside, setInside] = useState<BuildingId | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [talkingTo, setTalkingTo] = useState<NpcId | null>(null);
  const [tried, setTried] = useState(false);
  const [lastTalked, setLastTalked] = useState<Partial<Record<NpcId, number>>>({});
  const [beats, setBeats] = useState<Beat[]>([]);
  const [drawer, setDrawer] = useState<"ledger" | "scrolls" | null>(null);
  // Every visit opens on the title; Continue resumes the saved journey.
  const [opening, setOpening] = useState<OpeningStep | null>("title");
  // Chelo's tour of the city: once, after the first Set sail; again from the HUD's Guide.
  const [touring, setTouring] = useState(false);
  const seen = useRef<{ id: string; version: number } | null>(null);
  // ?demo shows the HUD over a sample run, for layout checks without a backend.
  const demo = useMemo(() => new URLSearchParams(window.location.search).has("demo"), []);
  const shown = run ?? (demo ? DEMO_RUN : null);
  const heard = useHeard(shown);
  const version = shown?.state.version ?? 0;

  const talkContext = useCallback(
    (id: NpcId) => ({ state: shown?.state ?? null, playable: !!run, heard, lastTalked: lastTalked[id] ?? 0 }),
    [shown, run, heard, lastTalked],
  );

  // Who has something new to say: the "!" over their heads. Re-sent when the city is ready.
  const alerts = useMemo(
    () => Object.fromEntries(NPCS.map((n) => [n.id, talk(n.id, talkContext(n.id)).alert])),
    [talkContext],
  );
  useEffect(() => {
    EventBus.emit("npc-alerts", alerts);
    return EventBus.on("city-ready", () => EventBus.emit("npc-alerts", alerts));
  }, [alerts]);

  // Atlantis sinks a little more each season: the city's water darkens with the year.
  const seasonIndex = shown ? viewOf(shown.state).season_index ?? 0 : 0;
  useEffect(() => {
    EventBus.emit("world-season", seasonIndex);
    return EventBus.on("city-ready", () => EventBus.emit("world-season", seasonIndex));
  }, [seasonIndex]);

  useEffect(
    () =>
      EventBus.on("building-entered", (id) => {
        setInside(id);
        const place = PLACES[id];
        if (run && place && run.state.available_actions.includes("visit")) void act({ kind: "visit", target: place });
      }),
    // ``act`` is recreated every render; the latest run is what matters.
    [run?.run_id, run?.state.version],
  );
  useEffect(
    () => EventBus.on("building-hover", (id, anchor) => setHover(id && anchor ? { id, anchor } : null)),
    [],
  );
  useEffect(
    () =>
      EventBus.on("npc-talk", (id) => {
        setTried(false);
        setTalkingTo(id);
      }),
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
    // A move that ends a season also opens the next: the old season's cards, then its report,
    // then whatever the new season opened with (a debasement, a clue).
    const fresh: Beat[] = momentsOf(run.state).flatMap((m): Beat[] =>
      m.kind === "season_end" && m.season
        ? [{ type: "report", season: m.season }]
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
    setOpening("who");
  };

  const view = shown ? viewOf(shown.state) : undefined;
  const leaveNpc = () => {
    if (!talkingTo) return;
    EventBus.emit("npc-left", talkingTo);
    setLastTalked((seen) => ({ ...seen, [talkingTo]: version }));
    setTalkingTo(null);
  };

  const choose = (choice: Choice) => {
    if (choice.goTo) {
      leaveNpc();
      EventBus.emit("go-to-building", choice.goTo);
    } else if (choice.action) {
      setTried(true);
      void act(choice.action);
    }
  };
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
        <Hud
          run={shown}
          ledger={bank.ledger}
          onLedger={() => setDrawer("ledger")}
          onScrolls={() => setDrawer("scrolls")}
          onGuide={run ? () => (leave(), leaveNpc(), setTouring(true)) : undefined}
        />
      )}
      {hover && !inside && !card && !talkingTo && !touring && (
        <BuildingCard building={BUILDINGS_BY_ID[hover.id]} anchor={hover.anchor} freeVisit={freeVisit(hover.id)} />
      )}

      {inside && room && phase !== "ended" && <BuildingRoom building={BUILDINGS_BY_ID[inside]} room={room} onLeave={leave} />}
      {inside && !room && <Dialogue building={BUILDINGS_BY_ID[inside]} onLeave={leave} />}
      {talkingTo && !card && (
        <NpcDialogue
          npc={NPCS_BY_ID[talkingTo]}
          talk={talk(talkingTo, talkContext(talkingTo))}
          busy={busy}
          error={tried ? error : ""}
          onChoose={choose}
          onLeave={leaveNpc}
        />
      )}

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
      {run && beat?.type === "report" && <ReportCard run={run} season={beat.season} onDone={nextBeat} />}
      {run && touring && !opening && !beat && phase !== "ended" && <Tour onDone={() => setTouring(false)} />}
      {run && !beat && !inside && phase === "final_call" && (
        <FinalCall run={run} busy={busy} act={act} onBank={() => goTo("bank")} />
      )}
      {run && !beat && phase === "ended" && <Ending run={run} onAgain={again} />}

      {run && drawer === "ledger" && <LedgerDrawer ledger={bank.ledger} onClose={() => setDrawer(null)} />}
      {run && drawer === "scrolls" && <ScrollsDrawer run={run} onClose={() => setDrawer(null)} />}

      {opening && !demo && (
        <Opening
          key={opening}
          start={opening}
          saved={run && phase !== "ended" ? `${run.state.season} · tide ${(view?.tide ?? 0) + 1}` : null}
          busy={busy}
          error={bank.error}
          onContinue={() => setOpening(null)}
          onSail={async (classId) => {
            const created = await bank.create(classId);
            if (created) {
              setOpening(null);
              if (!toured()) setTouring(true);
            }
            return created;
          }}
        />
      )}

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
