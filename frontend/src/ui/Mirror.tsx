import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

/** One entry in the Modern Mirror: a thing in Atlantis, what it is in the real world, and why. */
export interface MirrorEntry {
  here: string;
  there?: string;
  text: string;
}

/**
 * The Modern Mirror: a gilded hand-mirror button that opens a looking-glass showing what this
 * part of Atlantis is in the real world. Used in every room and on each season report.
 */
export function MirrorButton({
  title,
  entries,
  hint,
}: {
  title: string;
  entries: MirrorEntry[];
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!entries.length) return null;
  return (
    <>
      <button
        type="button"
        className="mirror-button"
        onClick={() => setOpen(true)}
      >
        <span className="mirror-button__glass" aria-hidden="true">
          <span className="mirror-button__shine" />
        </span>
        <span className="mirror-button__words">
          <span className="mirror-button__name">Modern Mirror</span>
          <span className="mirror-button__hint">
            {hint ?? "See it in the real world"}
          </span>
        </span>
        <span className="mirror-button__count" aria-hidden="true">
          {entries.length}
        </span>
      </button>
      {open && (
        <MirrorGlass
          title={title}
          entries={entries}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function MirrorGlass({
  title,
  entries,
  onClose,
}: {
  title: string;
  entries: MirrorEntry[];
  onClose: () => void;
}) {
  const titleId = useId();
  useEffect(() => {
    // Capture first, so Escape closes the mirror without also leaving the room behind it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  // On <body>, so it covers the screen whatever panel it was opened from.
  return createPortal(
    <div
      className="mirror-glass-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section className="mirror-glass" role="dialog" aria-labelledby={titleId}>
        <span className="mirror-glass__sheen" aria-hidden="true" />
        <header className="mirror-glass__head">
          <p className="mirror-glass__eyebrow">Modern Mirror</p>
          <h2 id={titleId} className="mirror-glass__title">
            {title}
          </h2>
        </header>
        <ul className="mirror-glass__list">
          {entries.map((e) => (
            <li key={e.here} className="mirror-glass__item">
              <p className="mirror-glass__pair">
                <span className="mirror-glass__here">{e.here}</span>
                {e.there && (
                  <>
                    <span className="mirror-glass__is" aria-label="is like">
                      ⟶
                    </span>
                    <span className="mirror-glass__there">{e.there}</span>
                  </>
                )}
              </p>
              <p className="mirror-glass__text">{e.text}</p>
            </li>
          ))}
        </ul>
        <button
          className="button mirror-glass__close"
          onClick={onClose}
          autoFocus
        >
          Back to Atlantis
        </button>
      </section>
    </div>,
    document.body,
  );
}
