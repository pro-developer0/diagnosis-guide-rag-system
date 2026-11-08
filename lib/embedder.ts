// Runs the embedding model inside the browser, so document text is never sent anywhere
// to be indexed. The library and weights (about 23 MB) download once, then the browser caches them.

const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";
export const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBED_DIM = 384;

export type Extractor = (texts: string[], opts: { pooling: "mean"; normalize: boolean }) => Promise<{ data: Float32Array }>;
export type LoadProgress = { loaded: number; total: number } | null;

let extractorPromise: Promise<Extractor> | null = null;

export function loadEmbedder(onProgress?: (p: LoadProgress) => void): Promise<Extractor> {
  if (extractorPromise) return extractorPromise;
  extractorPromise = (async () => {
    const mod = await import(/* webpackIgnore: true */ TRANSFORMERS_URL);
    const files = new Map<string, { loaded: number; total: number }>();
    const extractor = await mod.pipeline("feature-extraction", EMBED_MODEL, {
      dtype: "q8",
      progress_callback: (e: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (e.status === "progress" && e.file) {
          files.set(e.file, { loaded: e.loaded ?? 0, total: e.total ?? 0 });
          let loaded = 0;
          let total = 0;
          for (const f of files.values()) {
            loaded += f.loaded;
            total += f.total;
          }
          onProgress?.({ loaded, total });
        }
      },
    });
    onProgress?.(null);
    return extractor as Extractor;
  })();
  extractorPromise.catch(() => {
    extractorPromise = null; // allow a retry after a network failure
  });
  return extractorPromise;
}

export async function embedTexts(extractor: Extractor, texts: string[]): Promise<Float32Array> {
  const out = await extractor(texts, { pooling: "mean", normalize: true });
  return out.data;
}
