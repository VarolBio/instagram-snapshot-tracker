import { describe, expect, it } from 'vitest';
import {
  keywordsEqual,
  parseKeywordList,
  suggestCategory,
  suggestForAll,
} from '../src/analysis/classify';
import {
  RECOMMENDED_BRAND_KEYWORD_GROUPS,
  RECOMMENDED_BRAND_KEYWORDS,
} from '../src/model/keywords';

describe('suggesting which accounts are organisations', () => {
  it('flags handles that read like a business', () => {
    for (const handle of [
      'istanbulcoffeefestival',
      'tosfedofficial',
      'somebrand.store',
      'thedailypress',
      'ateliermarie',
    ]) {
      expect(suggestCategory(handle), handle).not.toBeNull();
    }
  });

  it('flags handles that read like a web address', () => {
    const suggestion = suggestCategory('journalclub.io');
    expect(suggestion?.matched).toBe('.io');
    expect(suggestion?.suggested).toBe('business');
  });

  it('stays silent on ordinary personal handles', () => {
    for (const handle of [
      'ayse.yilmaz',
      'mehmet_1998',
      'sarah.jane.k',
      'bora',
      'elifk',
      'j.smith',
    ]) {
      expect(suggestCategory(handle), handle).toBeNull();
    }
  });

  it('explains itself so the guess can be judged', () => {
    const suggestion = suggestCategory('bluebottlecoffee')!;
    expect(suggestion.matched).toBe('coffee');
    expect(suggestion.reason).toContain('coffee');
    expect(suggestion.reason).toContain('business or organisation');
  });

  it('never suggests a category for an account the user already set', () => {
    const { suggestions, skippedClassified } = suggestForAll(['someshop', 'otherstore'], {
      alreadyClassified: (h) => h === 'someshop',
    });
    expect(skippedClassified).toBe(1);
    expect(suggestions.map((s) => s.handle)).toEqual(['otherstore']);
  });

  it('leaves dismissed handles alone', () => {
    const { suggestions, skippedDismissed } = suggestForAll(['someshop', 'otherstore'], {
      dismissed: new Set(['someshop']),
    });
    expect(skippedDismissed).toBe(1);
    expect(suggestions.map((s) => s.handle)).toEqual(['otherstore']);
  });

  it('uses the caller\'s keyword list, not a hidden default, when one is passed', () => {
    expect(suggestCategory('officialpage', [])).toBeNull();
    expect(suggestCategory('my.museum', ['museum'])?.matched).toBe('museum');
  });

  it('prefers the longer matching term', () => {
    expect(suggestCategory('janesphotographer', ['photo', 'photographer'])?.matched).toBe(
      'photographer',
    );
  });

  it('only ever suggests, never returns a confirmed classification', () => {
    const results = ['ashop', 'anagency', 'x.io'].map((h) => suggestCategory(h)!);
    expect(results.every((r) => r.suggested === 'business')).toBe(true);
    expect(results.every((r) => r.reason.length > 0)).toBe(true);
  });

  it('keeps every recommended keyword long enough not to fire inside ordinary names', () => {
    for (const [group, words] of Object.entries(RECOMMENDED_BRAND_KEYWORD_GROUPS)) {
      for (const word of words) {
        expect(word.length, `${group}/${word}`).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('does not fire on names that merely contain a short brandish fragment', () => {
    for (const handle of ['nicole.b', 'martina', 'marco', 'tvorozhkov', 'artem']) {
      expect(suggestCategory(handle), handle).toBeNull();
    }
  });
});

describe('editing the keyword list', () => {
  it('splits on commas, spaces and line breaks, and drops duplicates', () => {
    expect(parseKeywordList('Shop, SHOP\nofficial  .io').keywords).toEqual([
      'shop',
      'official',
      '.io',
    ]);
  });

  it('ignores fragments that would match inside ordinary names', () => {
    expect(parseKeywordList('co art tv official').ignored).toEqual(['co', 'tv']);
    expect(parseKeywordList('co art tv official').keywords).toEqual(['art', 'official']);
  });

  it('treats the recommended list as equal to itself regardless of order', () => {
    expect(keywordsEqual([...RECOMMENDED_BRAND_KEYWORDS].reverse(), RECOMMENDED_BRAND_KEYWORDS)).toBe(
      true,
    );
  });
});
