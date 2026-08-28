"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hero pipeline demo - the product's signature moment. An application advances
 * Applied → Acknowledged → Shortlisted → Interview → Selected and its
 * Time-to-Acknowledgement resolves in. Honours prefers-reduced-motion by
 * settling statically at "Acknowledged · 18h 04m".
 */

const STEPS = [
  { glyph: "●", label: "Applied" },
  { glyph: "◉", label: "Acknowledged" },
  { glyph: "▲", label: "Shortlisted" },
  { glyph: "◆", label: "Interview" },
  { glyph: "✔", label: "Selected" },
];

export default function PipelineDemo() {
  const [stage, setStage] = useState(0);
  const [ttaShown, setTtaShown] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) {
      setStage(1);
      setTtaShown(true);
      return;
    }

    setStage(0);
    setTtaShown(false);
    let i = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const advance = () => {
      if (i === 1) setTtaShown(true);
      setStage(i);
      i += 1;
      if (i < STEPS.length) {
        timers.push(setTimeout(advance, i === 1 ? 1400 : 1600));
      }
    };
    timers.push(setTimeout(advance, 600));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="panel demo" aria-hidden="true">
      <div className="demo-head">
        <span className="tt">Live application</span>
        <span className="tt mono">#APP-2048</span>
      </div>
      <div className="demo-app">
        <span className="type">Research · Machine Learning</span>
        <h3>NLP Research Assistant</h3>
        <div className="by">Dr. A. Rao · CSED</div>

        <div className="stepper">
          {STEPS.map((s, i) => (
            <div
              key={s.label}
              className={`step ${i < stage ? "done" : ""} ${i === stage ? "current" : ""}`}
            >
              <div className="dot">{s.glyph}</div>
              <div className="cap">{s.label}</div>
              {i < STEPS.length - 1 && (
                <div className="line">
                  <span className="fill" style={{ width: i < stage ? "100%" : "0%" }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className={`tta-badge ${ttaShown ? "show" : ""}`}>
          <span>
            <span className="pulse-dot" />
            Time-to-Acknowledgement
          </span>
          <span className="v">{stage >= 1 ? "18h 04m" : "-"}</span>
        </div>
      </div>
    </div>
  );
}
