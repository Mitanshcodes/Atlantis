import type { Run } from "../types";
import { SCROLLS } from "./copy";
import { Drawer } from "./Drawers";
import { viewOf } from "./view";

/** All twelve Scrolls, earned ones lit. */
export function ScrollGrid({ earned }: { earned: Set<string> }) {
  return (
    <ul className="scrolls">
      {Object.entries(SCROLLS).map(([id, s]) => (
        <li key={id} className={`scroll ${earned.has(id) ? "is-earned" : ""}`}>
          <span className="scroll__name">{s.name}</span>
          <span className="scroll__how">{s.how}</span>
        </li>
      ))}
    </ul>
  );
}

export function ScrollsDrawer({ run, onClose }: { run: Run; onClose: () => void }) {
  return (
    <Drawer title="Scrolls" onClose={onClose}>
      <p className="room__note">Scrolls are earned by doing: good choices and bad ones both teach.</p>
      <ScrollGrid earned={new Set(viewOf(run.state).scrolls ?? [])} />
    </Drawer>
  );
}
