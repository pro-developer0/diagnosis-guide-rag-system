"use client";

import { useEffect, useRef } from "react";
import { Markdown } from "@/components/Markdown";
import type { KnowledgeDoc } from "@/lib/types";

/** Slide-over panel that shows one reference file in full. */
export function ReferenceReader({ doc, open, onClose }: { doc: KnowledgeDoc | null; open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={`reader-wrap ${open ? "is-on" : ""}`} inert={!open}>
      <div className="reader-scrim" onClick={onClose} />
      <section className="reader" role="dialog" aria-modal="true" aria-label={doc?.title ?? "Reference file"}>
        <header className="reader-head">
          <div>
            <p className="reader-category">{doc?.category}</p>
            <h2>{doc?.title}</h2>
          </div>
          <button ref={closeRef} type="button" className="reader-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="m3 3 8 8M11 3l-8 8" />
            </svg>
          </button>
        </header>
        <div className="reader-body answer" key={doc?.id}>
          {doc ? <Markdown text={doc.text.replace(/^# .*\n+/, "")} onCite={() => {}} maxCite={0} /> : <p className="pending">Loading</p>}
        </div>
        <p className="reader-note">Reference summary for healthcare staff. Check the current edition of the guideline named in this file before clinical use.</p>
      </section>
    </div>
  );
}
