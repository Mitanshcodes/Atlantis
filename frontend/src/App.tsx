import { useEffect, useMemo, useState } from "react";
import { BUILDINGS_BY_ID, type BuildingId } from "./game/buildings";
import { EventBus } from "./game/EventBus";
import { PhaserGame } from "./game/PhaserGame";
import { useBanking } from "./store";
import { BuildingCard } from "./ui/BuildingCard";
import { DEMO_RUN } from "./ui/demoRun";
import { Dialogue } from "./ui/Dialogue";
import { Hud, viewOf } from "./ui/Hud";

interface Hover {
  id: BuildingId;
  anchor: { x: number; y: number };
}

/** The city with the UI layered over it. Screens (class select, ending) will switch in here. */
export function App() {
  const { run } = useBanking();
  const [inside, setInside] = useState<BuildingId | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  // ?demo shows the HUD over a sample run, for layout checks without a backend.
  const demo = useMemo(() => new URLSearchParams(window.location.search).has("demo"), []);
  const shown = run ?? (demo ? DEMO_RUN : null);

  useEffect(() => EventBus.on("building-entered", setInside), []);
  useEffect(
    () => EventBus.on("building-hover", (id, anchor) => setHover(id && anchor ? { id, anchor } : null)),
    [],
  );

  const leave = () => {
    if (!inside) return;
    EventBus.emit("building-left", inside);
    setInside(null);
  };

  const freeVisits = shown ? viewOf(shown.state).free_visits : undefined;
  const freeVisit = (id: BuildingId) =>
    (id === "market" && !!freeVisits?.market) || (id === "harbor" && !!freeVisits?.exchange);

  return (
    <div className="app">
      <PhaserGame />
      {shown && <Hud run={shown} />}
      {hover && !inside && (
        <BuildingCard building={BUILDINGS_BY_ID[hover.id]} anchor={hover.anchor} freeVisit={freeVisit(hover.id)} />
      )}
      {inside && <Dialogue building={BUILDINGS_BY_ID[inside]} onLeave={leave} />}
    </div>
  );
}
