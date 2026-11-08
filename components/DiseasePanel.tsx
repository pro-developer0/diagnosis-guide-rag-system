"use client";

import { useMemo, useState } from "react";
import { CATALOG } from "@/lib/catalog";

export function DiseasePanel({
  excluded,
  onToggle,
  onSetAll,
  onOpen,
}: {
  excluded: Set<string>;
  onToggle: (slug: string) => void;
  onSetAll: (include: boolean) => void;
  onOpen: (slug: string) => void;
}) {
  const [filter, setFilter] = useState("");

  const groups = useMemo(() => {
    const term = filter.trim().toLowerCase();
    const map = new Map<string, typeof CATALOG>();
    for (const d of CATALOG) {
      if (term && !`${d.title} ${d.category}`.toLowerCase().includes(term)) continue;
      map.set(d.category, [...(map.get(d.category) ?? []), d]);
    }
    return [...map.entries()];
  }, [filter]);

  const selected = CATALOG.length - excluded.size;
  let index = 0;

  return (
    <aside className="library" aria-label="Disease list">
      <div className="library-head">
        <h2>Disease library</h2>
        <span className="count">{CATALOG.length}</span>
      </div>

      <label htmlFor="filter" className="sr-only">
        Filter diseases
      </label>
      <input id="filter" className="filter" type="search" placeholder="Filter diseases" value={filter} onChange={(e) => setFilter(e.target.value)} autoComplete="off" />

      <div className="scope">
        <span>
          Searching {selected} of {CATALOG.length}
        </span>
        <span className="scope-actions">
          <button type="button" className="text-btn" onClick={() => onSetAll(true)}>
            All
          </button>
          <button type="button" className="text-btn" onClick={() => onSetAll(false)}>
            None
          </button>
        </span>
      </div>

      <div className="disease-groups">
        {groups.length === 0 && <p className="library-empty">No disease matches that filter.</p>}
        {groups.map(([category, diseases]) => (
          <section key={category}>
            <h3 className="group-title">{category}</h3>
            <ul>
              {diseases.map((d) => (
                <li key={d.slug} className={`doc ${excluded.has(d.slug) ? "is-off" : ""}`} style={{ "--i": index++ } as React.CSSProperties}>
                  <input type="checkbox" checked={!excluded.has(d.slug)} onChange={() => onToggle(d.slug)} aria-label={`Include ${d.title} in search`} />
                  <button type="button" className="doc-open" onClick={() => onOpen(d.slug)} title={`Read ${d.title}`}>
                    {d.title}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="privacy">
        <h3>About this library</h3>
        <p>Search covers only these {CATALOG.length} reference files. Your question and the matching passages are sent to the AI service to write the answer.</p>
        <p>Do not enter identifiable patient information.</p>
      </div>
    </aside>
  );
}
