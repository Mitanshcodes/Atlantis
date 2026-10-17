import type { Building } from "../game/buildings";

interface Props {
  building: Building;
  /** The building's top-right corner on screen; the card sits just beside it. */
  anchor: { x: number; y: number };
  /** The engine is offering this visit without spending a tide. */
  freeVisit: boolean;
}

const CARD_W = 248;

/** The little card that names a building, its keeper and what a visit costs, while you hover it. */
export function BuildingCard({ building, anchor, freeVisit }: Props) {
  const free = !building.costsTide || freeVisit;
  // Keep the card on screen: flip it to the building's left when it would run off the right edge.
  const left = Math.max(12, Math.min(anchor.x + 12, window.innerWidth - CARD_W - 12));
  const top = Math.max(12, Math.min(anchor.y, window.innerHeight - 160));
  return (
    <aside className="panel building-card" style={{ left, top, width: CARD_W }} aria-live="polite">
      <h2 className="building-card__name">{building.name}</h2>
      <p className="building-card__keeper">Kept by {building.keeper}</p>
      <span className={`tag ${free ? "tag--free" : "tag--tide"}`}>
        {!building.costsTide ? "Free · costs no tide" : freeVisit ? "Free visit this time" : "A visit costs 1 tide"}
      </span>
      <p className="building-card__hint">Click to walk in</p>
    </aside>
  );
}
