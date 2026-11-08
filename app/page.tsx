"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DiseasePanel } from "@/components/DiseasePanel";
import { EvidenceList } from "@/components/Evidence";
import { Markdown } from "@/components/Markdown";
import { MedicalBackdrop } from "@/components/MedicalBackdrop";
import { motionOK, PulseLoader, Segmented } from "@/components/Motion";
import { ReferenceReader } from "@/components/ReferenceReader";
import { CATALOG } from "@/lib/catalog";
import { embedTexts, loadEmbedder } from "@/lib/embedder";
import { loadLibrary, type PrepareProgress } from "@/lib/knowledge";
import { buildIndex, buildPrompt, NOT_FOUND, search, sourceLabel, type LibraryIndex } from "@/lib/search";
import type { Hit, KnowledgeDoc, SearchMode } from "@/lib/types";

type Status = "searching" | "answering" | "done" | "error";
type Turn = { id: number; question: string; mode: SearchMode; hits: Hit[]; status: Status; answer: string; error: string | null };
type ServerInfo = { configured: boolean; model: string } | null;

const SUGGESTIONS = [
  "What are the diagnostic criteria for type 2 diabetes?",
  "How is malaria confirmed in the laboratory?",
  "What spirometry result confirms COPD?",
  "What are the warning signs in dengue?",
  "How is chronic kidney disease staged?",
];
const QUICK = ["Diagnostic criteria for ", "Confirmatory tests for ", "Differential diagnosis of ", "Red flags in ", "Typical presentation of "];
const K_OPTIONS: [number, string][] = [
  [3, "3"],
  [5, "5"],
  [8, "8"],
];
const MODES: [SearchMode, string][] = [
  ["hybrid", "Combined"],
  ["semantic", "Meaning"],
  ["keyword", "Exact terms"],
];

const passagesOf = (hits: Hit[]) => hits.map((h) => ({ source: sourceLabel(h.source, h.section), text: h.text }));

async function streamAnswer(body: object, onText: (t: string) => void, signal: AbortSignal) {
  const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `The server returned HTTP ${res.status}.`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }
}

export default function Home() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [index, setIndex] = useState<LibraryIndex | null>(null);
  const [prepare, setPrepare] = useState<PrepareProgress | null>({ label: "Loading reference files", pct: null });
  const [prepareError, setPrepareError] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [server, setServer] = useState<ServerInfo>(null);

  const [question, setQuestion] = useState("");
  const [k, setK] = useState(5);
  const [mode, setMode] = useState<SearchMode>("hybrid");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [activeCite, setActiveCite] = useState<number | null>(null);
  const [ping, setPing] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);

  const nextId = useRef(1);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const prepareLibrary = useCallback(() => {
    setPrepareError(false);
    loadLibrary(setPrepare)
      .then(({ docs: loaded, vectors }) => {
        setDocs(loaded);
        setIndex(buildIndex(loaded, vectors));
        setPrepare(null);
        // Start fetching the question model now, so the first question is not kept waiting.
        loadEmbedder().catch(() => {});
      })
      .catch(() => {
        setPrepare(null);
        setPrepareError(true);
      });
  }, []);

  useEffect(() => {
    prepareLibrary();
    fetch("/api/ask")
      .then((r) => r.json())
      .then(setServer)
      .catch(() => setServer({ configured: false, model: "" }));
  }, [prepareLibrary]);

  const searchable = CATALOG.length - excluded.size;
  const ready = index !== null && searchable > 0;

  const toggleDisease = (slug: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (!next.delete(slug)) next.add(slug);
      return next;
    });

  const setAll = (include: boolean) => setExcluded(include ? new Set() : new Set(CATALOG.map((d) => d.slug)));

  const openReader = useCallback((slug: string) => {
    setReading(slug);
    setReaderOpen(true);
  }, []);
  const closeReader = useCallback(() => setReaderOpen(false), []);

  const patch = (id: number, fn: (t: Turn) => Turn) => setTurns((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));

  const ask = async (raw: string) => {
    const q = raw.trim();
    if (!q || !ready || !index) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const useMode = mode;
    const id = nextId.current++;
    setTurns((ts) => [{ id, question: q, mode: useMode, hits: [], status: "searching", answer: "", error: null }, ...ts]);
    setSelected(id);
    setActiveCite(null);
    setQuestion("");
    window.scrollTo({ top: 0, behavior: motionOK() ? "smooth" : "auto" });

    let hits: Hit[];
    try {
      let qv: Float32Array | null = null;
      if (useMode !== "keyword") {
        const extractor = await loadEmbedder();
        qv = await embedTexts(extractor, [q]);
      }
      hits = search(index, q, qv, useMode, k, excluded);
    } catch {
      patch(id, (t) => ({ ...t, status: "error", error: "The search model could not load. Check your connection, or switch search to Exact terms." }));
      return;
    }

    if (hits.length === 0) {
      patch(id, (t) => ({ ...t, status: "done", answer: NOT_FOUND }));
      return;
    }
    if (!server?.configured) {
      patch(id, (t) => ({ ...t, hits, status: "done" }));
      return;
    }

    patch(id, (t) => ({ ...t, hits, status: "answering" }));
    await streamAnswer({ question: q, passages: passagesOf(hits) }, (text) => patch(id, (t) => ({ ...t, answer: text })), ctrl.signal)
      .then(() => patch(id, (t) => ({ ...t, status: "done" })))
      .catch((e) => {
        if (e.name !== "AbortError") patch(id, (t) => ({ ...t, status: "error", error: e.message }));
      });
  };

  const onCite = (turnId: number, n: number) => {
    setSelected(turnId);
    setActiveCite(n);
    requestAnimationFrame(() => {
      const wide = window.matchMedia("(min-width: 1180px)").matches;
      document.getElementById(`${wide ? "rail" : `turn-${turnId}`}-${n}`)?.scrollIntoView({ behavior: motionOK() ? "smooth" : "auto", block: "nearest" });
    });
  };

  const useQuick = (text: string) => {
    setQuestion(text);
    setPing(true);
    inputRef.current?.focus();
  };

  const current = turns.find((t) => t.id === selected) ?? turns[0] ?? null;
  const canAsk = ready && question.trim().length > 0;
  const busy = turns.some((t) => t.status === "searching" || t.status === "answering");
  const readingDoc = useMemo(() => docs.find((d) => d.id === reading) ?? null, [docs, reading]);
  const placeholder = !index ? "Preparing the reference library" : searchable === 0 ? "Select at least one disease to search" : "Ask about the diagnosis of any listed disease";

  return (
    // Files dropped on the page are ignored instead of opening in the tab.
    <div className="app" onDragOver={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()}>
      <MedicalBackdrop />
      <ReferenceReader doc={readingDoc} open={readerOpen} onClose={closeReader} />

      <header className="topbar">
        <div className="brand">
          <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="var(--accent)" />
            <path className="logo-trace" pathLength={1} d="M5 17h6l2.5-7 4.5 13 2.5-6H27" fill="none" stroke="var(--on-accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <p className="brand-name">Diagnosis Guide</p>
            <p className="brand-sub">Diagnostic reference for {CATALOG.length} common diseases</p>
          </div>
        </div>
        <p className="status" aria-live="polite">
          {server == null ? (
            "Checking AI service"
          ) : server.configured ? (
            <>
              <span className="dot is-on" aria-hidden="true" />
              AI service connected <code>{server.model.split("/").pop()}</code>
            </>
          ) : (
            <>
              <span className="dot" aria-hidden="true" />
              Search only, AI answers off
            </>
          )}
        </p>
      </header>

      <div className="shell">
        <DiseasePanel excluded={excluded} onToggle={toggleDisease} onSetAll={setAll} onOpen={openReader} />

        <main id="main" className={`workspace ${turns.length ? "has-turns" : ""}`}>
          <section className="thread" aria-label="Questions and answers">
            {turns.length === 0 && (
              <div className="intro">
                <h1>How is it diagnosed?</h1>
                <p>Ask about the criteria, tests, differentials and red flags for {CATALOG.length} common diseases. Every answer is drawn only from the built-in reference files and links to its source.</p>
              </div>
            )}

            {prepare && (
              <div className="prepare" role="status">
                <p>
                  <PulseLoader />
                  {prepare.label}
                  {prepare.pct != null && `, ${prepare.pct}%`}
                </p>
                <span className={`bar ${prepare.pct == null ? "is-busy" : ""}`}>
                  <span style={{ width: prepare.pct == null ? undefined : `${prepare.pct}%` }} />
                </span>
              </div>
            )}
            {prepareError && (
              <p className="notice is-error" role="alert">
                The reference library could not be prepared. Check your connection.{" "}
                <button type="button" className="text-btn" onClick={prepareLibrary}>
                  Try again
                </button>
              </p>
            )}

            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                ask(question);
              }}
            >
              <label htmlFor="q" className="sr-only">
                Your question
              </label>
              <div className={`composer-box ${ping ? "is-ping" : ""}`} onAnimationEnd={() => setPing(false)}>
                <textarea
                  id="q"
                  ref={inputRef}
                  rows={2}
                  value={question}
                  maxLength={1000}
                  disabled={!ready}
                  placeholder={placeholder}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      ask(question);
                    }
                  }}
                />
                <button type="submit" className={`ask-btn ${busy ? "is-busy" : ""}`} disabled={!canAsk && !busy} aria-busy={busy}>
                  Ask
                </button>
              </div>

              <div className="quick" aria-label="Question starters">
                {QUICK.map((q) => (
                  <button key={q} type="button" disabled={!ready} onClick={() => useQuick(q)}>
                    {q.trim()}
                  </button>
                ))}
              </div>

              <div className="controls">
                <Segmented legend="Passages" name="k" options={K_OPTIONS} value={k} onChange={setK} />
                <Segmented legend="Search" name="mode" options={MODES} value={mode} onChange={setMode} />
              </div>
              <p className="disclaimer">Reference tool for healthcare staff. It does not diagnose patients. Verify answers against the source and apply clinical judgment.</p>
            </form>

            {turns.length === 0 && (
              <div className="suggestions">
                <h2>Try one of these</h2>
                <ul>
                  {SUGGESTIONS.map((s, i) => (
                    <li key={s} style={{ "--i": i } as React.CSSProperties}>
                      <button type="button" disabled={!ready} onClick={() => ask(s)}>
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ol className="turns">
              {turns.map((t) => (
                <li key={t.id} className={`turn ${current?.id === t.id ? "is-selected" : ""}`} onClick={() => setSelected(t.id)}>
                  <h2 className="turn-q">{t.question}</h2>
                  <TurnBody turn={t} configured={server?.configured ?? false} onCite={(n) => onCite(t.id, n)} />
                  {t.hits.length > 0 && (
                    <details className="mobile-evidence">
                      <summary>Source passages ({t.hits.length})</summary>
                      <EvidenceList hits={t.hits} question={t.question} mode={t.mode} active={current?.id === t.id ? activeCite : null} idPrefix={`turn-${t.id}`} onOpen={openReader} answered={!t.answer.trim().startsWith(NOT_FOUND)} />
                    </details>
                  )}
                  {t.hits.length > 0 && server?.configured && (
                    <details className="prompt">
                      <summary>Text sent to the AI service</summary>
                      <pre>{buildPrompt(t.question, passagesOf(t.hits))}</pre>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          </section>

          {current && (
            <aside className="rail" aria-label="Source passages for the selected answer">
              <div className="rail-inner">
                <h2 className="rail-title">Source passages</h2>
                <p className="rail-q">{current.question}</p>
                {current.status === "searching" ? (
                  <>
                    <p className="pending">
                      <PulseLoader />
                      Searching the reference library
                    </p>
                    <div className="skeleton" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </div>
                  </>
                ) : (
                  <EvidenceList hits={current.hits} question={current.question} mode={current.mode} active={activeCite} idPrefix="rail" onOpen={openReader} answered={!current.answer.trim().startsWith(NOT_FOUND)} />
                )}
              </div>
            </aside>
          )}
        </main>
      </div>
    </div>
  );
}

function TurnBody({ turn, configured, onCite }: { turn: Turn; configured: boolean; onCite: (n: number) => void }) {
  if (turn.status === "searching") {
    return (
      <p className="pending">
        <PulseLoader />
        Searching the reference library
      </p>
    );
  }
  if (turn.error && !turn.answer) return <p className="error-text">{turn.error}</p>;
  if (!configured && turn.status === "done" && !turn.answer) {
    return (
      <p className="notice">
        AI answers are off because the server has no <code>LLM_API_KEY</code>. The matching passages are shown alongside.
      </p>
    );
  }
  return (
    <div className="answer" aria-live="polite" aria-busy={turn.status === "answering"}>
      {turn.answer ? (
        <Markdown text={turn.answer} onCite={onCite} maxCite={turn.hits.length} />
      ) : (
        <p className="pending">
          <PulseLoader />
          Writing an answer from {turn.hits.length} {turn.hits.length === 1 ? "passage" : "passages"}
        </p>
      )}
      {turn.status === "answering" && turn.answer && <span className="caret" aria-hidden="true" />}
      {turn.error && <p className="error-text">{turn.error}</p>}
    </div>
  );
}
