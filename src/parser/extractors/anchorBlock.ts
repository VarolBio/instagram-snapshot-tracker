import { extractHandleFromHref, parseTimestamp, pickDisplayHandle } from '../normalize';
import type { ExtractedEntry, Extractor } from './types';

/** How far up from a link we are willing to look for its follow date. */
const MAX_ANCESTOR_HOPS = 5;

/**
 * Walks outward from a profile link looking for that entry's follow date.
 *
 * The stopping rule matters more than the search: as soon as an ancestor contains a
 * second profile link we have left this entry's block, and any timestamp beyond that
 * point belongs to a neighbour. Better no date than the wrong account's date.
 */
function findTimestampNear(
  anchor: Element,
  isProfileAnchor: (el: Element) => boolean,
): { epoch?: number; raw: string } | null {
  let node: Element | null = anchor.parentElement;

  for (let hop = 0; node && hop < MAX_ANCESTOR_HOPS; hop++, node = node.parentElement) {
    const profileAnchors = Array.from(node.querySelectorAll('a[href]')).filter(isProfileAnchor);
    if (profileAnchors.length > 1) return null;

    // Page chrome holds the export's own "generated on" <time>. Reaching it means we
    // have climbed out of the entry list, and that date is not this account's follow date.
    if (node.querySelector('aside[role="contentinfo"], header')) return null;

    const timeEl = node.querySelector('time[datetime]');
    const iso = timeEl?.getAttribute('datetime');
    if (iso) {
      const epoch = Date.parse(iso);
      if (!Number.isNaN(epoch)) return { epoch, raw: iso };
    }

    const parsed = parseTimestamp(textExcludingAnchor(node, anchor));
    if (parsed) return { epoch: parsed.epoch, raw: parsed.raw };
  }

  return null;
}

/**
 * The export puts nothing between the username and its date, so an ancestor reads as
 * "alexAug 01, 2026 9:09 am". Removing the link text first keeps the parsed timestamp
 * clean, which matters because its exact text is the key rename matching compares on.
 */
function textExcludingAnchor(node: Element, anchor: Element): string {
  const full = node.textContent ?? '';
  const anchorText = anchor.textContent ?? '';
  return anchorText ? full.split(anchorText).join(' ') : full;
}

/**
 * The primary strategy, matching every Instagram HTML export format seen so far.
 * Handles come from the href rather than the link text, because `following.html`
 * renders the full URL as its link text.
 */
export const anchorBlockExtractor: Extractor = {
  id: 'anchor-block',
  confidence: 'high',

  extract(doc: Document): ExtractedEntry[] {
    const isProfileAnchor = (el: Element) =>
      extractHandleFromHref(el.getAttribute('href') ?? '') !== null;

    const anchors = Array.from(doc.querySelectorAll('a[href]'));
    const entries: ExtractedEntry[] = [];

    for (const anchor of anchors) {
      const handle = extractHandleFromHref(anchor.getAttribute('href') ?? '');
      if (!handle) continue;

      const timestamp = findTimestampNear(anchor, isProfileAnchor);
      entries.push({
        handle,
        displayHandle: pickDisplayHandle(anchor.textContent ?? '', handle),
        profileUrl: `https://www.instagram.com/${handle}`,
        followedAt: timestamp?.epoch,
        followedAtRaw: timestamp?.raw,
      });
    }

    return entries;
  },
};
