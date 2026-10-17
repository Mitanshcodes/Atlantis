import { useEffect, useState } from "react";
import { BUILDINGS_BY_ID, type BuildingId } from "./game/buildings";
import { EventBus } from "./game/EventBus";
import { PhaserGame } from "./game/PhaserGame";
import { Dialogue } from "./ui/Dialogue";

/** The city with the UI layered over it. Screens (class select, ending) will switch in here. */
export function App() {
  const [inside, setInside] = useState<BuildingId | null>(null);

  useEffect(() => EventBus.on("building-entered", setInside), []);

  const leave = () => {
    if (!inside) return;
    EventBus.emit("building-left", inside);
    setInside(null);
  };

  return (
    <div className="app">
      <PhaserGame />
      {inside && <Dialogue building={BUILDINGS_BY_ID[inside]} onLeave={leave} />}
    </div>
  );
}
