import { parseHandleToken } from '../normalize';
import type { ExtractedEntry, Extractor } from './types';

const AT_HANDLE_RE = /@([A-Za-z0-9._]{1,30})\b/g;

/**
 * Last-resort strategy for a future export format that drops profile links entirely
 * and prints plain `@handle` text. It recovers usernames but no follow dates, so it
 * is marked low confidence and the snapshot says so.
 */
export const textListExtractor: Extractor = {
  id: 'text-list',
  confidence: 'low',

  extract(doc: Document): ExtractedEntry[] {
    const text = doc.body?.textContent ?? '';
    const seen = new Set<string>();
    const entries: ExtractedEntry[] = [];

    for (const match of text.matchAll(AT_HANDLE_RE)) {
      const handle = parseHandleToken(match[1]);
      if (!handle || seen.has(handle)) continue;
      seen.add(handle);
      entries.push({
        handle,
        displayHandle: match[1],
        profileUrl: `https://www.instagram.com/${handle}`,
      });
    }

    return entries;
  },
};
