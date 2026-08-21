/**
 * Recommended organisation-looking fragments for username guesses.
 *
 * These are a starting list the user can edit. A word only belongs here if it is far
 * more likely in a brand handle than in a person's name. Short fragments like "co" or
 * "art" are excluded because they fire inside ordinary names.
 */

export const RECOMMENDED_BRAND_KEYWORD_GROUPS: Record<string, readonly string[]> = {
  Commerce: ['shop', 'store', 'market', 'boutique', 'brand', 'outlet'],
  Organisation: [
    'official',
    'agency',
    'studio',
    'academy',
    'institute',
    'federation',
    'foundation',
    'society',
  ],
  Venue: ['cafe', 'coffee', 'restaurant', 'kitchen', 'bakery', 'hotel', 'clinic', 'fitness'],
  Media: ['media', 'news', 'magazine', 'records', 'podcast', 'blog', 'daily', 'press'],
  Creative: ['photography', 'photographer', 'design', 'designs', 'atelier'],
  Events: ['festival', 'fest', 'events', 'expo', 'summit', 'conference'],
};

/** Suffixes that read as a domain name rather than a person. */
export const RECOMMENDED_BRAND_SUFFIXES: readonly string[] = [
  '.io',
  '.com',
  '.co',
  '.net',
  '.org',
  '.app',
  '.tr',
];

export const RECOMMENDED_BRAND_KEYWORDS: readonly string[] = [
  ...Object.values(RECOMMENDED_BRAND_KEYWORD_GROUPS).flat(),
  ...RECOMMENDED_BRAND_SUFFIXES,
];
