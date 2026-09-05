"use client";

import Link from "next/link";
import type { Opportunity } from "@/lib/client/api";
import {
  closesLabel,
  oppTypeLabel,
  slaLabel,
  statusClass,
  stipendLabel,
  titleCase,
} from "@/lib/client/format";

export function OpportunityCard({ opportunity: o }: { opportunity: Opportunity }) {
  const seatsOpen = o.seatCount - o.seatsFilled;

  return (
    <Link href={`/opportunities/${o.id}`} className="ocard">
      <div className="ocard-top">
        <span className="ocard-type">{oppTypeLabel(o.type)}</span>
        <span className={`pill ${statusClass(o.status)}`}>{titleCase(o.status)}</span>
      </div>
      <h3>{o.title}</h3>
      <p className="tl-meta">
        Posted by {o.poster.name} · {titleCase(o.poster.role)}
      </p>
      <p className="desc">{o.description}</p>
      {o.skills.length > 0 && (
        <div className="tagrow">
          {o.skills.slice(0, 4).map((s) => (
            <span key={s.id} className={`tag${s.requirement === "REQUIRED" ? " req" : ""}`}>
              {s.name}
            </span>
          ))}
        </div>
      )}
      <div className="ocard-meta">
        <span className="m">{o.domain}</span>
        <span className="m">{stipendLabel(o.stipend, o.stipendAmount)}</span>
        <span className="m">{seatsOpen} of {o.seatCount} seats</span>
        <span className="m">{closesLabel(o.deadline)}</span>
        <span className="m">{slaLabel(o.slaPledge)}</span>
      </div>
    </Link>
  );
}
