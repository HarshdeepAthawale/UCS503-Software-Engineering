const STEPS = [
  {
    n: "1",
    title: "Declare roles",
    body: "Name your team, pick the hackathon, and list the slots you need (e.g. backend, ML).",
  },
  {
    n: "2",
    title: "Fill slots",
    body: "Email invite links to friends, or accept join requests from students browsing open teams.",
  },
  {
    n: "3",
    title: "Lock & ship",
    body: "When every role is filled, lock the roster and coordinate via team meetings.",
  },
] as const;

/** Compact explainer — shown until the student has at least one team. */
export function TeamsHowItWorks() {
  return (
    <section className="teams-how panel" aria-label="How hackathon teams work">
      <p className="teams-how-eyebrow">How it works</p>
      <ol className="teams-how-steps">
        {STEPS.map((s) => (
          <li key={s.n} className="teams-how-step">
            <span className="teams-how-num" aria-hidden="true">{s.n}</span>
            <div>
              <strong>{s.title}</strong>
              <p>{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
