"use client";

import React from "react";
import { COVERAGE_THRESHOLD, STOP } from "@/lib/search";
import { tokenize } from "@/lib/tfidf";
import type { Hit, SearchMode } from "@/lib/types";

const tidy = (text: string) => text.replace(/[ \t]+\n/g, "\n").replace(/\n{2,}/g, "\n").trim();
const queryTerms = (q: string) => [...new Set(tokenize(q).filter((t) => t.length >= 3 && !STOP.has(t)))];

function Highlighted({ text, question }: { text: string; question: string }) {
  const terms = queryTerms(question);
  if (terms.length === 0) return <>{text}</>;
  return (
    <>
      {text.split(/([\p{L}\p{N}_]+)/u).map((p, i) => {
        const w = p.toLowerCase();
        const hit = terms.some((t) => w === t || (t.length >= 4 && w.startsWith(t) && w.length - t.length <= 3) || (w.length >= 4 && t.startsWith(w) && t.length - w.length <= 2));
        return hit ? <mark key={i}>{p}</mark> : <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </>
  );
}

function ScoreMeter({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <span className={`meter ${value >= COVERAGE_THRESHOLD ? "is-strong" : "is-weak"}`} role="img" aria-label={`Match strength ${value.toFixed(2)}`}>
      <span className="meter-track">
        <span className="meter-fill" style={{ width: `${pct}%` }} />
        <span className="meter-tick" style={{ left: `${COVERAGE_THRESHOLD * 100}%` }} />
      </span>
      <span className="meter-value">{value.toFixed(2)}</span>
    </span>
  );
}

function Verdict({ hits }: { hits: Hit[] }) {
  if (hits[0]?.semantic == null) return <p className="verdict">Matched on exact terms only, so match strength is not available.</p>;
  const best = Math.max(...hits.map((h) => h.semantic ?? 0));
  return best >= COVERAGE_THRESHOLD ? (
    <p className="verdict is-strong">Relevant passages found. Best match {best.toFixed(2)}.</p>
  ) : (
    <p className="verdict is-weak">Weak match ({best.toFixed(2)}). The reference library may not cover this question.</p>
  );
}

export function EvidenceList({
  hits,
  question,
  active,
  idPrefix,
  onOpen,
  answered,
}: {
  hits: Hit[];
  question: string;
  mode: SearchMode;
  active: number | null;
  idPrefix: string;
  onOpen: (docId: string) => void;
  answered: boolean;
}) {
  if (hits.length === 0) return <p className="empty-note">No passage matched this question. Rephrase it or change the search method.</p>;
  return (
    <>
      {answered ? <Verdict hits={hits} /> : <p className="verdict is-weak">These are the closest passages, but they do not answer this question.</p>}
      <ol className="evidence-list">
        {hits.map((h, i) => (
          <li key={h.id} id={`${idPrefix}-${i + 1}`} className={`passage ${active === i + 1 ? "is-active" : ""}`} style={{ "--i": i } as React.CSSProperties}>
            <div className="passage-head">
              <span className="passage-num" aria-hidden="true">
                {i + 1}
              </span>
              <button type="button" className="passage-source" title={`Open ${h.source}`} onClick={() => onOpen(h.docId)}>
                {h.source}
              </button>
              {h.semantic != null && <ScoreMeter value={h.semantic} />}
            </div>
            <p className="passage-page">{h.section}</p>
            <p className="passage-text">
              <Highlighted text={tidy(h.text)} question={question} />
            </p>
          </li>
        ))}
      </ol>
    </>
  );
}
