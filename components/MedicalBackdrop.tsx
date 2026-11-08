"use client";

// Line drawings of clinical instruments behind the workspace. Purely decorative.

import { useEffect, useRef } from "react";
import { motionOK } from "./Motion";

const ECG =
  "M0 60h150l14-8 14 8h30l10 14 16-70 18 88 12-32h32l16-12 18 12h130l14-8 14 8h30l10 14 16-70 18 88 12-32h32l16-12 18 12h130l14-8 14 8h30l10 14 16-70 18 88 12-32h32l16-12 18 12h130l14-8 14 8h30l10 14 16-70 18 88 12-32h32l16-12 18 12h120";

function Stethoscope() {
  return (
    <>
      <path d="M20 4v34a26 26 0 0 0 52 0V4" />
      <path d="M12 4h16M64 4h16" />
      <path d="M46 64v34a24 24 0 0 0 48 0V78" />
      <circle cx="94" cy="64" r="14" />
      <circle cx="94" cy="64" r="5" />
    </>
  );
}

function Syringe() {
  return (
    <>
      <rect x="30" y="16" width="70" height="24" rx="2" />
      <path d="M30 8v40M30 28H6M6 14v28" />
      <path d="M100 22h12v12h-12M112 28h34" />
      <path d="M48 16v9M62 16v9M76 16v9M90 16v9" />
    </>
  );
}

function Capsule() {
  return (
    <>
      <rect width="90" height="36" rx="18" />
      <path d="M45 0v36" />
    </>
  );
}

function TestTube() {
  return (
    <>
      <path d="M16 0h44M24 0v92a14 14 0 0 0 28 0V0" />
      <path d="M24 56h28" />
      <circle cx="38" cy="74" r="4" />
      <circle cx="33" cy="92" r="3" />
    </>
  );
}

function Clipboard() {
  return (
    <>
      <rect y="12" width="84" height="108" rx="6" />
      <rect x="26" y="2" width="32" height="20" rx="4" />
      <path d="M16 46h52M16 66h52M16 86h34" />
    </>
  );
}

function Microscope() {
  return (
    <>
      <path d="M46 2h20v10H46zM50 12h12v48H50zM53 60h6v12h-6z" />
      <path d="M24 84h64" />
      <path d="M66 20a44 44 0 0 1 8 80" />
      <path d="M10 116h92M74 100v16" />
    </>
  );
}

function Heart() {
  return (
    <>
      <path d="M50 88S6 60 6 30a22 22 0 0 1 44-6 22 22 0 0 1 44 6c0 30-44 58-44 58z" />
      <path d="M14 46h20l8-14 12 28 8-14h24" />
    </>
  );
}

function IvBag() {
  return (
    <>
      <path d="M20 12h50a6 6 0 0 1 6 6v60a20 20 0 0 1-20 20H34a20 20 0 0 1-20-20V18a6 6 0 0 1 6-6z" />
      <path d="M45 98v34M45 2v10" />
      <path d="M28 40h20M28 56h14M28 72h20" />
    </>
  );
}

const PLACED = [
  { C: Stethoscope, x: 1282, y: 96, r: 10, s: 1.25 },
  { C: Microscope, x: 1262, y: 545, r: 0, s: 1.4 },
  { C: Syringe, x: 345, y: 400, r: -62, s: 1.05 },
  { C: Clipboard, x: 350, y: 575, r: -8, s: 1.15 },
  { C: Capsule, x: 1040, y: 630, r: -32, s: 1.05 },
  { C: TestTube, x: 610, y: 655, r: 18, s: 0.95 },
  { C: Heart, x: 815, y: 628, r: 8, s: 0.9 },
  { C: IvBag, x: 1335, y: 305, r: 6, s: 1 },
];

const artStyle = (depth: number) => ({ "--d": depth }) as React.CSSProperties;

export function MedicalBackdrop() {
  const ref = useRef<HTMLDivElement>(null);

  // The instruments lean slightly away from the pointer, nearer ones further.
  useEffect(() => {
    if (!motionOK() || !window.matchMedia("(hover: hover)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        ref.current?.style.setProperty("--px", ((0.5 - e.clientX / window.innerWidth) * 2).toFixed(3));
        ref.current?.style.setProperty("--py", ((0.5 - e.clientY / window.innerHeight) * 2).toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div className="backdrop" aria-hidden="true" ref={ref}>
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {PLACED.map(({ C, x, y, r, s }, i) => (
          <g key={i} className="art" style={artStyle(6 + (i % 3) * 5)}>
            <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
              <g className={`float ${C === Heart ? "is-beat" : ""}`} style={C === Heart ? undefined : { animationDelay: `${-i * 1.7}s`, animationDuration: `${8 + (i % 4) * 1.5}s` }}>
                <C />
              </g>
            </g>
          </g>
        ))}
        <g transform="translate(320 780)">
          <path className="art" style={artStyle(0)} d={ECG} />
          <path className="ecg-sweep" pathLength={1} d={ECG} />
        </g>
      </svg>
    </div>
  );
}
