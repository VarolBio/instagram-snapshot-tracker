import { anchorBlockExtractor } from './anchorBlock';
import { textListExtractor } from './textList';
import type { ExtractedEntry, Extractor } from './types';

export type { ExtractedEntry, Extractor };

/**
 * Ordered strategy registry. The first strategy that produces entries wins, and the
 * winner's id is recorded on the snapshot so any result can be traced back to the code
 * that read it. Supporting a new export format means adding one file here.
 */
export const EXTRACTORS: readonly Extractor[] = [anchorBlockExtractor, textListExtractor];

export interface ExtractionResult {
  extractorId: string | null;
  confidence: 'high' | 'low' | null;
  entries: ExtractedEntry[];
}

export function runExtractors(doc: Document): ExtractionResult {
  for (const extractor of EXTRACTORS) {
    const entries = extractor.extract(doc);
    if (entries.length > 0) {
      return { extractorId: extractor.id, confidence: extractor.confidence, entries };
    }
  }
  return { extractorId: null, confidence: null, entries: [] };
}
