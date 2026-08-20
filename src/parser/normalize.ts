/**
 * Turning what the export prints into a stable key.
 *
 * Two quirks of real exports drive this file:
 *  - `following.html` links to `instagram.com/_u/<handle>` while `followers_1.html`
 *    links to `instagram.com/<handle>`. The `_u/` deep-link prefix must be stripped.
 *  - In `following.html` the anchor *text* is the full URL, not the handle. Handles
 *    therefore always come from the href, never from the link text.
 */

/** Instagram paths that are site features rather than profiles. */
const RESERVED_PATHS = new Set([
  'p',
  'reel',
  'reels',
  'tv',
  'stories',
  'explore',
  'accounts',
  'direct',
  'about',
  'legal',
  'developer',
  'challenge',
  'oauth',
  'emails',
  'session',
  'graphql',
  'api',
  'privacy',
  'terms',
  '_n',
  's',
]);

const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

/** Extracts a normalized handle from an Instagram profile URL, or null if it is not one. */
export function extractHandleFromHref(href: string): string | null {
  let pathname: string;
  try {
    const url = new URL(href.trim(), 'https://www.instagram.com');
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!/^(www\.)?instagram\.com$/i.test(url.hostname)) return null;
    pathname = url.pathname;
  } catch {
    return null;
  }

  let segments = pathname.split('/').filter(Boolean);
  if (segments[0] === '_u') segments = segments.slice(1);

  const first = segments[0];
  if (!first) return null;

  let decoded = first;
  try {
    decoded = decodeURIComponent(first);
  } catch {
    // Leave the raw segment in place if it is not valid percent-encoding.
  }

  if (RESERVED_PATHS.has(decoded.toLowerCase())) return null;
  if (!HANDLE_RE.test(decoded)) return null;
  return decoded.toLowerCase();
}

/** Parses a bare token such as `@some.one` or `some.one` into a normalized handle. */
export function parseHandleToken(token: string): string | null {
  const trimmed = token.trim().replace(/^@/, '').replace(/\/+$/, '');
  if (!HANDLE_RE.test(trimmed)) return null;
  if (RESERVED_PATHS.has(trimmed.toLowerCase())) return null;
  return trimmed.toLowerCase();
}

/**
 * Prefers the export's own spelling when the link text is a real handle, so that
 * casing the user recognises survives. Falls back to the normalized handle when the
 * link text is a URL, as it is throughout `following.html`.
 */
export function pickDisplayHandle(anchorText: string, handle: string): string {
  const candidate = anchorText.trim().replace(/^@/, '');
  if (candidate.toLowerCase() === handle && HANDLE_RE.test(candidate)) return candidate;
  return handle;
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/**
 * The month must be spelled out as a real month rather than "any three letters".
 * A loose `[A-Za-z]{3}[a-z]*` combined with the case-insensitive flag happily reads
 * "alexAug 01, 2026" as month "ale", inventing a date out of a username.
 */
const MONTH =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DATE = `\\b${MONTH}\\.?\\s+(\\d{1,2}),\\s*(\\d{4})`;

// "Aug 01, 2026 9:09 am" - the format Instagram HTML exports actually use.
const TS_MERIDIEM = new RegExp(
  `${DATE},?\\s+(\\d{1,2}):(\\d{2})(?::(\\d{2}))?\\s*([ap])\\.?m\\.?`,
  'i',
);
// Same shape but 24-hour, in case a locale variant drops the meridiem.
const TS_24H = new RegExp(`${DATE},?\\s+(\\d{1,2}):(\\d{2})(?::(\\d{2}))?\\b`, 'i');
const TS_DATE_ONLY = new RegExp(`${DATE}\\b`, 'i');

export interface ParsedTimestamp {
  /** The matched text exactly as it appeared, used as the rename-matching key. */
  raw: string;
  /** Epoch ms, or undefined when the text matched loosely but produced no valid date. */
  epoch?: number;
}

/**
 * The export prints follow dates without a timezone, so they are read as UTC. That is
 * a consistent choice rather than a correct one, which is why `raw` is kept alongside:
 * anything that must be exact (rename matching) compares the raw text instead.
 */
export function parseTimestamp(text: string): ParsedTimestamp | null {
  const meridiem = TS_MERIDIEM.exec(text);
  if (meridiem) {
    const [raw, mon, day, year, hour, minute, second, ap] = meridiem;
    let h = Number(hour) % 12;
    if (ap.toLowerCase() === 'p') h += 12;
    return { raw: raw.trim(), epoch: toEpoch(mon, day, year, h, minute, second) };
  }

  const h24 = TS_24H.exec(text);
  if (h24) {
    const [raw, mon, day, year, hour, minute, second] = h24;
    return { raw: raw.trim(), epoch: toEpoch(mon, day, year, Number(hour), minute, second) };
  }

  const dateOnly = TS_DATE_ONLY.exec(text);
  if (dateOnly) {
    const [raw, mon, day, year] = dateOnly;
    return { raw: raw.trim(), epoch: toEpoch(mon, day, year, 0, '0', undefined) };
  }

  return null;
}

function toEpoch(
  mon: string,
  day: string,
  year: string,
  hour: number,
  minute: string,
  second: string | undefined,
): number | undefined {
  const month = MONTHS[mon.slice(0, 3).toLowerCase()];
  if (month === undefined) return undefined;
  const epoch = Date.UTC(Number(year), month, Number(day), hour, Number(minute), Number(second ?? 0));
  return Number.isNaN(epoch) ? undefined : epoch;
}
