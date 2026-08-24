/**
 * Guessing which accounts are organisations rather than people.
 *
 * The export contains no follower count, verification flag or account type, so there is
 * nothing here to derive a real answer from. All this does is read the username, which
 * makes it a guess and nothing more. Every result is a *suggestion* the user confirms,
 * never an applied classification.
 *
 * Measured against a real export of 640 non-followers with the recommended list: tens of
 * matches and zero of the 56 accounts known to be real people were flagged. High
 * precision, low recall - the right trade when a wrong guess hides a friend.
 */

import { RECOMMENDED_BRAND_KEYWORDS } from '../model/keywords';
import type { AccountCategory } from '../model/types';
import { t } from '../i18n';

export interface CategorySuggestion {
  handle: string;
  suggested: AccountCategory;
  /** The exact substring that triggered it, so the user can judge the guess. */
  matched: string;
  reason: string;
}

export interface ParsedKeywordList {
  keywords: string[];
  ignored: string[];
}

/**
 * Turns a textarea into a keyword list. Commas, spaces and line breaks all separate
 * terms. Duplicates are dropped. Fragments shorter than 3 characters are ignored, except
 * "tv", which is kept and matched only as a suffix.
 */
export function parseKeywordList(text: string): ParsedKeywordList {
  const seen = new Set<string>();
  const keywords: string[] = [];
  const ignored: string[] = [];

  for (const raw of text.split(/[,;\n\r\t ]+/)) {
    const term = raw.trim().toLowerCase();
    if (!term) continue;
    if (!isUsableKeyword(term)) {
      ignored.push(term);
      continue;
    }
    if (seen.has(term)) continue;
    seen.add(term);
    keywords.push(term);
  }

  return { keywords, ignored };
}

export function isUsableKeyword(term: string): boolean {
  if (term.startsWith('.')) return term.length >= 3;
  if (term === 'tv') return true;
  return foldTurkish(term).length >= 3;
}

/** Instagram handles are ASCII, so ı/ş/ğ/ü/ö/ç are folded to i/s/g/u/o/c before matching. */
export function foldTurkish(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u')
    .replaceAll('â', 'a')
    .replaceAll('î', 'i')
    .replaceAll('û', 'u');
}

export function keywordsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const other = new Set(b);
  return a.every((term) => other.has(term));
}

/**
 * Returns a suggestion when a username reads like an organisation, or null when there is
 * nothing to say. Silence is the common case and the correct one.
 *
 * Longer terms win, so "photographer" is reported rather than "photo" when both match.
 */
export function suggestCategory(
  handle: string,
  keywords: readonly string[] = RECOMMENDED_BRAND_KEYWORDS,
): CategorySuggestion | null {
  const foldedHandle = foldTurkish(handle);
  const ranked = [...keywords].sort((a, b) => foldTurkish(b).length - foldTurkish(a).length);

  for (const term of ranked) {
    if (!matchesTerm(foldedHandle, term)) continue;
    return {
      handle,
      suggested: 'business',
      matched: term,
      reason: describeMatch(term),
    };
  }

  return null;
}

function matchesTerm(foldedHandle: string, term: string): boolean {
  const foldedTerm = foldTurkish(term);
  if (term.startsWith('.')) return foldedHandle.endsWith(foldedTerm) || foldedHandle.includes(foldedTerm);
  // Two-letter terms like "tv" only count at the end of a handle ("failtv"), never inside it.
  if (foldedTerm.length <= 2) {
    return foldedHandle === foldedTerm || foldedHandle.endsWith(foldedTerm);
  }
  return foldedHandle.includes(foldedTerm);
}

function describeMatch(term: string): string {
  if (term.startsWith('.')) {
    return t('classify.domain', { term });
  }
  return t('classify.word', { term });
}

export interface SuggestionSummary {
  suggestions: CategorySuggestion[];
  /** Handles the user has already categorised, which are never re-suggested. */
  skippedClassified: number;
  /** Handles the user waved off for this guess. */
  skippedDismissed: number;
}

/** Suggestions for a list of accounts, leaving anything already decided alone. */
export function suggestForAll(
  handles: readonly string[],
  options: {
    keywords?: readonly string[];
    alreadyClassified?: (handle: string) => boolean;
    dismissed?: ReadonlySet<string>;
  } = {},
): SuggestionSummary {
  const keywords = options.keywords ?? RECOMMENDED_BRAND_KEYWORDS;
  const alreadyClassified = options.alreadyClassified ?? (() => false);
  const dismissed = options.dismissed ?? new Set<string>();
  const suggestions: CategorySuggestion[] = [];
  let skippedClassified = 0;
  let skippedDismissed = 0;

  for (const handle of handles) {
    if (alreadyClassified(handle)) {
      skippedClassified++;
      continue;
    }
    if (dismissed.has(handle)) {
      skippedDismissed++;
      continue;
    }
    const suggestion = suggestCategory(handle, keywords);
    if (suggestion) suggestions.push(suggestion);
  }

  suggestions.sort((a, b) => a.handle.localeCompare(b.handle));
  return { suggestions, skippedClassified, skippedDismissed };
}
