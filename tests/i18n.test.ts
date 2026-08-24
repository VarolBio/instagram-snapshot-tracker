import { afterEach, describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { formatParseWarning, setLocale, t } from '../src/i18n';
import { tr } from '../src/i18n/tr';

type Tree = { [key: string]: string | Tree };

function keysOf(tree: Tree, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [name, value] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${name}` : name;
    if (typeof value === 'string') keys.push(key);
    else keys.push(...keysOf(value, key));
  }
  return keys;
}

afterEach(() => {
  setLocale('en');
});

describe('English and Turkish dictionaries', () => {
  it('cover the same keys', () => {
    expect(keysOf(tr as unknown as Tree).sort()).toEqual(keysOf(en as unknown as Tree).sort());
  });

  it('translates parse warnings from the code, not the stored English message', () => {
    setLocale('tr');
    const text = formatParseWarning({
      code: 'kind_conflict',
      message: 'English leftover',
      path: 'followers_1.html',
      params: { fromFilename: 'follower', fromDocument: 'following' },
    });
    expect(text).toContain('Takipçiler');
    expect(text).toContain('Takip edilenler');
    expect(text).not.toContain('English leftover');
    setLocale('en');
    expect(t('tab.upload')).toBe('Upload');
  });
});
