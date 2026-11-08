"use client";

import { useLayoutEffect, useRef, useState } from "react";

export const motionOK = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A small heartbeat trace that stands in for a spinner. */
export function PulseLoader() {
  return (
    <svg className="pulse-loader" width="30" height="14" viewBox="0 0 30 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path pathLength={1} d="M1 8h7l2-5 4 10 3-7 2 2h10" />
    </svg>
  );
}

/** Radio group with a thumb that slides to the selected option. */
export function Segmented<T extends string | number>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const label = track.querySelector("input:checked")?.closest("label");
      if (label) setThumb({ x: label.offsetLeft, w: label.offsetWidth });
    };
    measure();
    // label widths change when the web font arrives or the layout wraps
    const observer = new ResizeObserver(measure);
    track.querySelectorAll("label").forEach((l) => observer.observe(l));
    return () => observer.disconnect();
  }, [value]);

  return (
    <fieldset className="segmented">
      <legend>{legend}</legend>
      <div className="seg-track" ref={trackRef}>
        <div className="seg-thumb" aria-hidden="true" style={thumb ? { transform: `translateX(${thumb.x}px)`, width: thumb.w } : { opacity: 0 }} />
        {options.map(([v, label]) => (
          <label key={v}>
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
