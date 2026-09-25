const STEPS = [
  { title: "Post your roles", body: "Name the team and the event, and list the spots you need." },
  { title: "Fill the spots", body: "Invite friends by email, or accept requests from students browsing teams." },
  { title: "Team complete", body: "When every spot is filled the team locks, and you plan with team meetings." },
] as const;

/** Three-step explainer, shown until the student is on (or has asked to join) a team. */
export function TeamsHowItWorks() {
  return (
    <section className="card how-strip" aria-label="How teams work">
      <ol>
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="how-num" aria-hidden="true">{i + 1}</span>
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
