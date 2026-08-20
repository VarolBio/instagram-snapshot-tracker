export interface ExtractedEntry {
  handle: string;
  displayHandle: string;
  profileUrl?: string;
  followedAt?: number;
  followedAtRaw?: string;
}

export interface Extractor {
  id: string;
  /**
   * `low` marks strategies that guess at structure. When one of these wins, the
   * snapshot carries a warning so the user knows the reading is less reliable.
   */
  confidence: 'high' | 'low';
  extract(doc: Document): ExtractedEntry[];
}
