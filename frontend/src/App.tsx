import { useCallback, useEffect, useMemo, useState } from "react";
import { BUILDINGS_BY_ID, type BuildingId } from "./game/buildings";
import { EventBus } from "./game/EventBus";
import { NPCS, NPCS_BY_ID, type NpcId } from "./game/npcs";
import { PhaserGame } from "./game/PhaserGame";
import { useBanking } from "./store";
import { BuildingCard } from "./ui/BuildingCard";
import { DEMO_RUN } from "./ui/demoRun";
import { Dialogue } from "./ui/Dialogue";
import { Hud, viewOf } from "./ui/Hud";
import { NpcDialogue } from "./ui/NpcDialogue";
import { talk, type Choice } from "./ui/npcTalk";
import { useHeard } from "./ui/useHeard";

interface Hover {
  id: BuildingId;
  anchor: { x: number; y: number };
}

/** Buildings that are engine Places: walking in is a free Visit, which the event deck notices. */
const PLACES: Partial<Record<BuildingId, string>> = {
  bank: "bank",
  market: "market",
  harbor: "harbor",
  drowned_bell: "drowned_bell",
  black_reef: "black_reef",
};

/** The city with the UI layered over it. Screens (class select, ending) will switch in here. */
export function App() {
  const { run, busy, error, act } = useBanking();
  const [inside, setInside] = useState<BuildingId | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [talkingTo, setTalkingTo] = useState<NpcId | null>(null);
  const [tried, setTried] = useState(false);
  const [lastTalked, setLastTalked] = useState<Partial<Record<NpcId, number>>>({});
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

  const leave = () => {
    if (!inside) return;
    EventBus.emit("building-left", inside);
    setInside(null);
  };

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

  const freeVisits = shown ? viewOf(shown.state).free_visits : undefined;
  const freeVisit = (id: BuildingId) =>
    (id === "market" && !!freeVisits?.market) || (id === "harbor" && !!freeVisits?.exchange);

  return (
    <div className="app">
      <PhaserGame />
      {shown && <Hud run={shown} />}
      {hover && !inside && !talkingTo && (
        <BuildingCard building={BUILDINGS_BY_ID[hover.id]} anchor={hover.anchor} freeVisit={freeVisit(hover.id)} />
      )}
      {inside && <Dialogue building={BUILDINGS_BY_ID[inside]} onLeave={leave} />}
      {talkingTo && (
        <NpcDialogue
          npc={NPCS_BY_ID[talkingTo]}
          talk={talk(talkingTo, talkContext(talkingTo))}
          busy={busy}
          error={tried ? error : ""}
          onChoose={choose}
          onLeave={leaveNpc}
        />
      )}
    </div>
  );
}
