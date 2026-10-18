import { useEffect } from "react";
import { npcPortraitUrl, type Npc } from "../game/npcs";
import type { Choice, Talk } from "./npcTalk";

interface Props {
  npc: Npc;
  talk: Talk;
  busy: boolean;
  /** The engine's answer to the last thing tried, if it refused. */
  error: string;
  onChoose: (choice: Choice) => void;
  onLeave: () => void;
}

/** A conversation in the street: who they are, what they have to say, and what they offer. */
export function NpcDialogue({ npc, talk, busy, error, onChoose, onLeave }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onLeave();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLeave]);

  return (
    <div className="panel npc-dialogue" role="dialog" aria-labelledby="npc-name">
      <img className="npc-dialogue__portrait" src={npcPortraitUrl(npc)} alt="" />
      <div className="npc-dialogue__body">
        <p className="dialogue__eyebrow">{npc.title}</p>
        <h2 id="npc-name" className="dialogue__title">
          {npc.name}
        </h2>
        {talk.lines.map((line, i) => (
          <p key={i} className="npc-dialogue__line">
            “{line}”
          </p>
        ))}
        {error && <p className="npc-dialogue__error">{error}</p>}
        <div className="npc-dialogue__choices">
          {talk.choices.map((choice) => (
            <div key={choice.label} className="npc-dialogue__choice">
              <button
                className="button button--ghost"
                disabled={busy || !!choice.blocked}
                title={choice.blocked}
                onClick={() => onChoose(choice)}
              >
                {choice.label}
              </button>
              {(choice.blocked || choice.note) && (
                <span className="npc-dialogue__note">{choice.blocked ?? choice.note}</span>
              )}
            </div>
          ))}
          <button className="button" onClick={onLeave} autoFocus>
            Farewell
          </button>
        </div>
      </div>
    </div>
  );
}
