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
      'citycoffeefestival',
      'sportsfedofficial',
      'somebrand.store',
      'thedailypress',
      'ateliermarie',
    ]) {
      expect(suggestCategory(handle), handle).not.toBeNull();
    }
  });

  it('flags handles that read like a web address', () => {
    const suggestion = suggestCategory('site.io');
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
        if (word === 'tv') continue;
        expect(word.length, `${group}/${word}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('has no duplicate recommended keywords', () => {
    expect(new Set(RECOMMENDED_BRAND_KEYWORDS).size).toBe(RECOMMENDED_BRAND_KEYWORDS.length);
  });

  it('does not fire on names that merely contain a short brandish fragment', () => {
    for (const handle of ['nicole.b', 'martina', 'marco', 'tvorozhkov', 'artem']) {
      expect(suggestCategory(handle), handle).toBeNull();
    }
  });

  it('matches tv only as a suffix', () => {
    expect(suggestCategory('failtv')?.matched).toBe('tv');
    expect(suggestCategory('best.tv')?.matched).toBe('.tv');
    expect(suggestCategory('activist')).toBeNull();
  });

  it('folds Turkish letters so kültür matches kultur and atatürk matches ataturk', () => {
    expect(suggestCategory('kulturpage', ['kültür'])?.matched).toBe('kültür');
    expect(suggestCategory('kültürpage', ['kultur'])?.matched).toBe('kultur');
    expect(suggestCategory('ataturkmuze', ['atatürk'])?.matched).toBe('atatürk');
    expect(suggestCategory('atatürkmüze')?.matched).toMatch(/ataturk|atatürk|muze|müze/);
  });

  it('keeps noisy shorts out of the recommended list', () => {
    const present = new Set(RECOMMENDED_BRAND_KEYWORDS);
    for (const word of [
      'sol',
      'son',
      'art',
      'sine',
      'cine',
      'uni',
      'edu',
      'milli',
      'rock',
      'union',
      'univ',
      'ask',
      'pub',
      'bot',
      'wood',
      'tree',
      'sas',
      'red',
      'ong',
    ]) {
      expect(present.has(word), word).toBe(false);
    }
    expect(present.has('.edu')).toBe(true);
  });

  it('includes the pasted compact terms people actually use in handles', () => {
    const present = new Set(RECOMMENDED_BRAND_KEYWORDS);
    for (const word of [
      'tarih',
      'haber',
      '9gag',
      '1907',
      '1905',
      '1903',
      'manutd',
      'mancity',
      'akademi',
      'psikolog',
      'kültür',
      'kultur',
      'üniversite',
      'universite',
      'ataturk',
      'futbol',
      'sondakika',
      'dogaclama',
      'symposium',
      'football',
      'atolye',
      'gmbh',
      'oficial',
      'tienda',
    ]) {
      expect(present.has(word), word).toBe(true);
    }
  });

  it('picks up organisation, place and club words', () => {
    expect(suggestCategory('campusuniversity')?.matched).toBe('university');
    expect(suggestCategory('dept.edu')?.matched).toBe('.edu');
    expect(suggestCategory('runnersclub')?.matched).toBe('club');
    expect(suggestCategory('thedailyhub')?.matched).toBe('daily');
    expect(suggestCategory('agencyholding')?.matched).toBe('holding');
    expect(suggestCategory('visitistanbul')?.matched).toBe('istanbul');
    expect(suggestCategory('galatasaraystore')?.matched).toBe('galatasaray');
    expect(suggestCategory('crossfitgym')?.matched).toBe('gym');
    expect(suggestCategory('officialpage')?.matched).toBe('officialpage');
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
    expect(parseKeywordList('co art tv official').ignored).toEqual(['co']);
    expect(parseKeywordList('co art tv official').keywords).toEqual(['art', 'tv', 'official']);
  });

  it('treats the recommended list as equal to itself regardless of order', () => {
    expect(keywordsEqual([...RECOMMENDED_BRAND_KEYWORDS].reverse(), RECOMMENDED_BRAND_KEYWORDS)).toBe(
      true,
    );
  });

  it('includes the focused organisation words, minus a few that fire inside ordinary names', () => {
    const skipped = new Set(['band', 'spa']);
    const requested = [
      'academy', 'accessories', 'accounting', 'activism', 'advertising', 'affiliate',
      'agency', 'airlines', 'alliance', 'alumni', 'ambassador', 'analytics', 'animals',
      'apparel', 'architecture', 'archive', 'artist', 'association', 'astrology',
      'athletics', 'auction', 'audio', 'automotive', 'bakery', 'band', 'bank', 'barbershop',
      'beauty', 'blog', 'blogger', 'bookings', 'books', 'bookshop', 'bookstore',
      'boutique', 'brand', 'broadcast', 'brokerage', 'builder', 'business', 'cafe',
      'campaign', 'campus', 'careers', 'catering', 'celebrity', 'channel', 'charity',
      'church', 'cinema', 'clinic', 'clothing', 'club', 'coach', 'coaching', 'coalition',
      'college', 'comedy', 'commerce', 'community', 'company', 'conference',
      'construction', 'consultancy', 'consulting', 'contentcreator', 'cosmetics',
      'council', 'coupon', 'courses', 'creativeagency', 'creator', 'crypto', 'daily',
      'danceacademy', 'danceschool', 'dealership', 'deals', 'department', 'designagency',
      'designstudio', 'digitalagency', 'digitalcreator', 'directory', 'discount',
      'distribution', 'distributor', 'ecommerce', 'education', 'embassy', 'enterprise',
      'enterprises', 'entertainment', 'equipment', 'events', 'fanaccount', 'fanbase',
      'fanclub', 'fandom', 'fanpage', 'fans', 'fashion', 'federation', 'finance',
      'fitness', 'florist', 'foodblog', 'foodie', 'footballclub', 'forum', 'foundation',
      'gallery', 'gaming', 'global', 'government', 'group', 'guild', 'gym', 'haircare',
      'hairsalon', 'health', 'holdings', 'hospital', 'hostel', 'hotel', 'influencer',
      'institute', 'insurance', 'international', 'investing', 'investments', 'journal',
      'lawfirm', 'league', 'legalservices', 'lifestyleblog', 'limited', 'logistics',
      'magazine', 'management', 'manufacturer', 'marketing', 'marketplace', 'media',
      'medical', 'members', 'membership', 'ministry', 'modelagency', 'municipality',
      'museum', 'musiclabel', 'network', 'news', 'newsdaily', 'newspaper', 'newsroom',
      'nonprofit', 'nutrition', 'official', 'officialaccount', 'officialbrand',
      'officialclub', 'officialpage', 'officialshop', 'officialstore', 'onlineshop',
      'onlinestore', 'organization', 'outlet', 'pharmacy', 'photographer', 'photography',
      'podcast', 'podcaster', 'politics', 'press', 'production', 'productions',
      'professional', 'promotions', 'property', 'publicfigure', 'publisher', 'publishing',
      'radio', 'realestate', 'records', 'recruitment', 'rentals', 'repairservice',
      'reseller', 'resort', 'restaurant', 'retail', 'salon', 'school', 'shop',
      'shoponline', 'society', 'solutions', 'spa', 'sportsclub', 'startup', 'store',
      'streamer', 'studio', 'supporters', 'supportersclub', 'team', 'technews',
      'theofficial', 'theatre', 'tourism', 'tours', 'trainer', 'travel', 'university',
      'verified', 'videochannel', 'videocreator', 'vlogger', 'volunteers', 'warehouse',
      'weddingplanner', 'wellness', 'wholesale', 'worldwide', 'yoga', 'youtuber',
    ];
    const present = new Set(RECOMMENDED_BRAND_KEYWORDS);
    expect(requested.filter((word) => !skipped.has(word) && !present.has(word))).toEqual([]);
  });
});
