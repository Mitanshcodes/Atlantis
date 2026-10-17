import { useEffect } from "react";
import type { Building } from "../game/buildings";

interface Props {
  building: Building;
  onLeave: () => void;
}

/** The keeper's greeting when you walk into a building. The building's real panel replaces this. */
export function Dialogue({ building, onLeave }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onLeave();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLeave]);

  return (
    <div className="panel dialogue" role="dialog" aria-labelledby="dialogue-title">
      <p className="dialogue__eyebrow">{building.keeper}</p>
      <h2 id="dialogue-title" className="dialogue__title">
        {building.name}
      </h2>
      <p className="dialogue__line">“{building.greeting}”</p>
      <button className="button" onClick={onLeave} autoFocus>
        Leave
      </button>
    </div>
  );
}
