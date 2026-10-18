/** The three-step progress mark at the top of the opening: ■ — ■ — ■ and "Step N of 3". */
export function Steps({ step, label, align = "center" }: { step: 1 | 2 | 3; label?: string; align?: "center" | "left" }) {
  return (
    <div className={`steps steps--${align}`} aria-label={`Step ${step} of 3`}>
      <div className="steps__marks" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className="steps__group">
            {n > 1 && <span className="steps__line" />}
            <span className={`steps__dot ${n === step ? "is-now" : n < step ? "is-done" : ""}`} />
          </span>
        ))}
      </div>
      <p className="steps__text">
        Step {step} of 3{label ? ` · ${label}` : ""}
      </p>
    </div>
  );
}
