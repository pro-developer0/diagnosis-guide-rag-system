export type SearchMode = "hybrid" | "semantic" | "keyword";

export type StoredChunk = { t: string; s: string };

export type KnowledgeDoc = {
  id: string;
  title: string;
  category: string;
  text: string;
  chunks: StoredChunk[];
};

export type Hit = {
  id: number;
  text: string;
  docId: string;
  source: string;
  section: string;
  semantic: number | null;
  keyword: number;
  score: number;
};
