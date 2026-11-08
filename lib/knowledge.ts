// Loads the built-in reference files and prepares them for search, in the browser.
import { CATALOG } from "./catalog";
import { embedTexts, EMBED_DIM, EMBED_MODEL, loadEmbedder, type LoadProgress } from "./embedder";
import { readCache, writeCache } from "./store";
import type { KnowledgeDoc, StoredChunk } from "./types";

// Large enough to keep most sections whole, so a list of criteria is never split from its heading.
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 100;
const BATCH = 16;

export type PrepareProgress = { label: string; pct: number | null };

function recursiveChunk(text: string): string[] {
  const separators = ["\n\n", "\n", ". ", " "];

  function split(t: string, seps: string[]): string[] {
    if (t.length <= CHUNK_SIZE) return [t];
    if (seps.length === 0) {
      const out: string[] = [];
      for (let i = 0; i < t.length; i += CHUNK_SIZE - CHUNK_OVERLAP) out.push(t.slice(i, i + CHUNK_SIZE));
      return out;
    }
    const sep = seps[0];
    const parts = t.split(sep);
    const pieces = parts.map((p, i) => (i < parts.length - 1 ? p + sep : p));
    const chunks: string[] = [];
    let current = "";
    for (const piece of pieces) {
      if (current.length + piece.length <= CHUNK_SIZE) {
        current += piece;
      } else {
        if (current) chunks.push(current);
        if (piece.length > CHUNK_SIZE) {
          chunks.push(...split(piece, seps.slice(1)));
          current = "";
        } else {
          current = piece;
        }
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  const chunks = split(text, separators).filter((c) => c.trim());
  return chunks.map((c, i) => (i < chunks.length - 1 ? c + chunks[i + 1].slice(0, CHUNK_OVERLAP) : c));
}

/** Splits a file on its "## " headings, so each passage knows its section. */
function toChunks(text: string): StoredChunk[] {
  const sections: { title: string; lines: string[] }[] = [];
  for (const line of text.replace(/\r/g, "").split("\n")) {
    if (line.startsWith("# ")) continue;
    if (line.startsWith("## ")) sections.push({ title: line.slice(3).trim(), lines: [] });
    else sections.at(-1)?.lines.push(line);
  }
  // A one-line guideline section would match on the disease name alone and crowd out real
  // content, so it travels with the overview instead of competing as its own passage.
  const guideline = sections.findIndex((s) => s.title === "Guideline basis");
  if (guideline > 0) {
    const [g] = sections.splice(guideline, 1);
    sections[0].lines.push("", `Guideline basis: ${g.lines.join(" ").trim()}`);
  }
  return sections.flatMap((s) => recursiveChunk(s.lines.join("\n").trim()).map((t) => ({ t, s: s.title })));
}

function fingerprint(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export async function loadLibrary(onProgress: (p: PrepareProgress) => void): Promise<{ docs: KnowledgeDoc[]; vectors: Float32Array }> {
  onProgress({ label: "Loading reference files", pct: null });
  const docs: KnowledgeDoc[] = await Promise.all(
    CATALOG.map(async ({ slug, title, category }) => {
      const res = await fetch(`/knowledge/${slug}.md`);
      if (!res.ok) throw new Error(`Could not load ${title}.`);
      const text = await res.text();
      return { id: slug, title, category, text, chunks: toChunks(text) };
    }),
  );

  const passages = docs.flatMap((d) => d.chunks.map((c) => `${d.title}. ${c.s}. ${c.t}`));
  const hash = fingerprint([EMBED_MODEL, CHUNK_SIZE, CHUNK_OVERLAP, ...passages].join("\u0000"));
  const expected = passages.length * EMBED_DIM * Float32Array.BYTES_PER_ELEMENT;

  // The search index ships with the site. If the files have changed since it was built,
  // the hash no longer matches and the browser builds its own below.
  try {
    const manifest = await fetch("/knowledge/index.json").then((r) => (r.ok ? r.json() : null));
    if (manifest?.hash === hash) {
      const res = await fetch("/knowledge/vectors.bin");
      const buffer = res.ok ? await res.arrayBuffer() : null;
      if (buffer?.byteLength === expected) return { docs, vectors: new Float32Array(buffer) };
    }
  } catch {
    // fall through to the browser-built index
  }

  const cached = await readCache();
  if (cached?.hash === hash && cached.vectors.byteLength === expected) return { docs, vectors: new Float32Array(cached.vectors) };

  const extractor = await loadEmbedder((p: LoadProgress) => {
    if (p?.total) onProgress({ label: "Loading the search model (first visit only)", pct: Math.round((p.loaded / p.total) * 100) });
  });
  const vectors = new Float32Array(passages.length * EMBED_DIM);
  for (let i = 0; i < passages.length; i += BATCH) {
    onProgress({ label: "Preparing the reference library", pct: Math.round((i / passages.length) * 100) });
    vectors.set(await embedTexts(extractor, passages.slice(i, i + BATCH)), i * EMBED_DIM);
  }
  await writeCache(hash, vectors.buffer as ArrayBuffer);
  return { docs, vectors };
}
