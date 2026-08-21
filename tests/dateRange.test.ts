/**
 * Exports can be requested for a limited date range, and Instagram trims the followers
 * list to that range. Comparing an all-time export against a two-month one therefore
 * puts hundreds of accounts in the "missing" column purely because the later export was
 * never asked for them.
 */

import { describe, expect, it } from 'vitest';
import { diffSnapshots } from '../src/analysis/diff';
import { PARSER_VERSION, type Observation, type Snapshot } from '../src/model/types';

const YEAR = 365 * 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-08-01T00:00:00.000Z');

function follower(handle: string, followedAt: number): Observation {
  return {
    handle,
    displayHandle: handle,
    kind: 'follower',
    followedAt,
    followedAtRaw: new Date(followedAt).toISOString(),
    sourcePath: 'followers_1.html',
  };
}

function snapshot(
  id: string,
  exportedAt: number,
  coverageFrom: number,
  observations: Observation[],
): Snapshot {
  return {
    id,
    label: id,
    exportedAt: new Date(exportedAt).toISOString(),
    exportedAtSource: 'document_header',
    importedAt: new Date(exportedAt).toISOString(),
    parserVersion: PARSER_VERSION,
    coverage: { from: new Date(coverageFrom).toISOString(), to: new Date(exportedAt).toISOString() },
    sourceFiles: [],
    kindsPresent: ['follower'],
    warnings: [],
    observations,
    contentHash: id,
  };
}

/** 300 long-standing followers plus 5 who arrived in the last two months. */
const longStanding = Array.from({ length: 300 }, (_, i) =>
  follower(`old_${i}`, NOW - 5 * YEAR + i * 1000),
);
const recent = Array.from({ length: 5 }, (_, i) => follower(`new_${i}`, NOW - 30 * 24 * 3600_000));

const allTime = snapshot('All time', NOW - 60 * 24 * 3600_000, NOW - 8 * YEAR, longStanding);

/**
 * The same account two months later, exported with a two-month range. Everyone still
 * follows, but Instagram only lists those acquired inside the window.
 */
const twoMonth = snapshot('Last two months', NOW, NOW - 60 * 24 * 3600_000, recent);

describe('comparing exports taken over different date ranges', () => {
  it('does not report a mass exodus that is really just a narrower date range', () => {
    const followers = diffSnapshots(allTime, twoMonth).kinds.find((k) => k.kind === 'follower')!;

    // Nobody actually left. All 300 are absent only because the later export was
    // limited to the last two months.
    expect(followers.disappeared).toEqual([]);
  });

  it('accounts for them explicitly rather than dropping them silently', () => {
    const followers = diffSnapshots(allTime, twoMonth).kinds.find((k) => k.kind === 'follower')!;
    expect(followers.outOfRange).toHaveLength(300);
    expect(followers.outOfRange[0].evidence).toBe('insufficient_evidence');
    expect(followers.outOfRange[0].statement).toContain('date range');
  });

  it('warns that the two exports do not cover the same period', () => {
    const followers = diffSnapshots(allTime, twoMonth).kinds.find((k) => k.kind === 'follower')!;
    expect(followers.rangeWarning).toBeDefined();
    expect(followers.rangeWarning).toContain('Last two months');
  });

  it('still reports genuinely new followers from inside the window', () => {
    const followers = diffSnapshots(allTime, twoMonth).kinds.find((k) => k.kind === 'follower')!;
    expect(followers.appeared.map((e) => e.handle).sort()).toEqual([
      'new_0',
      'new_1',
      'new_2',
      'new_3',
      'new_4',
    ]);
  });

  it('still reports a real departure that falls inside the later window', () => {
    // This account followed inside the two-month window, so the later export would
    // have listed it had they still been there. Their absence is real evidence.
    const leaver = follower('left_recently', NOW - 45 * 24 * 3600_000);
    const before = snapshot('All time', NOW - 60 * 24 * 3600_000, NOW - 8 * YEAR, [
      ...longStanding,
      leaver,
    ]);

    const followers = diffSnapshots(before, twoMonth).kinds.find((k) => k.kind === 'follower')!;
    expect(followers.disappeared.map((e) => e.handle)).toEqual(['left_recently']);
    expect(followers.outOfRange).toHaveLength(300);
  });

  it('leaves same-range comparisons completely untouched', () => {
    const janList = [follower('stays', NOW - 3 * YEAR), follower('leaves', NOW - 3 * YEAR)];
    const aprList = [follower('stays', NOW - 3 * YEAR)];

    const jan = snapshot('January', NOW - YEAR, NOW - 8 * YEAR, janList);
    const apr = snapshot('April', NOW, NOW - 8 * YEAR, aprList);

    const followers = diffSnapshots(jan, apr).kinds.find((k) => k.kind === 'follower')!;
    expect(followers.disappeared.map((e) => e.handle)).toEqual(['leaves']);
    expect(followers.outOfRange).toEqual([]);
    expect(followers.rangeWarning).toBeUndefined();
  });

  it('does not suppress departures in a list the range never trimmed', () => {
    // The following list keeps pre-window entries even on a narrow export, which proves
    // the range was not applied to it. Departures there must still be reported.
    const withFollowing = (id: string, handles: string[]): Snapshot => ({
      ...snapshot(id, NOW, NOW - 60 * 24 * 3600_000, []),
      kindsPresent: ['following'],
      observations: handles.map((h) => ({
        ...follower(h, NOW - 5 * YEAR),
        kind: 'following' as const,
        sourcePath: 'following.html',
      })),
    });

    const before = withFollowing('Before', ['a', 'b', 'c']);
    const after = withFollowing('After', ['a', 'b']);

    const following = diffSnapshots(before, after).kinds.find((k) => k.kind === 'following')!;
    expect(following.disappeared.map((e) => e.handle)).toEqual(['c']);
    expect(following.outOfRange).toEqual([]);
  });
});
