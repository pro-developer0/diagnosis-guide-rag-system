// Caches the search vectors in this browser, so the library is only indexed once.
// Failures are ignored: without a cache the index is simply rebuilt on the next visit.

const DB = "diagnosis-guide";
const STORE = "cache";
const KEY = "index";

export type CachedIndex = { id: string; hash: string; vectors: ArrayBuffer };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function readCache(): Promise<CachedIndex | null> {
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(KEY);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as CachedIndex | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

export async function writeCache(hash: string, vectors: ArrayBuffer): Promise<void> {
  try {
    const db = await open();
    db.transaction(STORE, "readwrite").objectStore(STORE).put({ id: KEY, hash, vectors });
    db.close();
  } catch {
    // caching is optional
  }
}
