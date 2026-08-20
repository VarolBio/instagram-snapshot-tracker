/**
 * The journey a user actually takes: upload an export, upload another one months
 * later, and read what changed. Asserts the success criteria the whole app rests on.
 */

import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { buildCurrentState, nonFollowers } from '../src/analysis/currentState';
import { diffSnapshots } from '../src/analysis/diff';
import { buildTimeline } from '../src/analysis/timeline';
import { parseUpload } from '../src/parser';
import type { ParsedSnapshot, Snapshot } from '../src/model/types';
import { buildExportHtml, type FixtureEntry } from './fixtures/exports';

function commit(parsed: ParsedSnapshot, id: string): Snapshot {
  return { ...parsed, id, label: id, importedAt: new Date().toISOString() };
}

function archive(
  generatedAt: string,
  followers: FixtureEntry[],
  following: FixtureEntry[] | null,
): File {
  const files: Record<string, Uint8Array> = {
    'connections/followers_and_following/followers_1.html': strToU8(
      buildExportHtml({ heading: 'Followers', generatedAt, entries: followers }),
    ),
  };
  if (following) {
    files['connections/followers_and_following/following.html'] = strToU8(
      buildExportHtml({
        heading: 'Following',
        linkStyle: 'following',
        generatedAt,
        entries: following,
      }),
    );
  }
  const name = `instagram-me-${generatedAt.slice(0, 10)}-A1b2.zip`;
  return new File([zipSync(files) as BlobPart], name, { type: 'application/zip' });
}

const JAN = '2026-01-10T09:00Z';
const APR = '2026-04-10T09:00Z';

describe('two exports, three months apart', () => {
  it('reports arrivals, departures and a rename without overstating any of them', async () => {
    const january = commit(
      await parseUpload([
        archive(
          JAN,
          [
            { handle: 'staying.friend', timestamp: 'May 04, 2021 8:00 am' },
            { handle: 'old.username', timestamp: 'Jun 06, 2022 3:30 pm' },
            { handle: 'quiet.leaver', timestamp: 'Sep 09, 2023 11:15 am' },
          ],
          [
            { handle: 'staying.friend', timestamp: 'May 04, 2021 8:05 am' },
            { handle: 'a.brand', timestamp: 'Jan 02, 2024 1:00 pm' },
          ],
        ),
      ]),
      'January',
    );

    const april = commit(
      await parseUpload([
        archive(
          APR,
          [
            { handle: 'staying.friend', timestamp: 'May 04, 2021 8:00 am' },
            // Same follow date as old.username: Instagram carries it across a rename.
            { handle: 'new.username', timestamp: 'Jun 06, 2022 3:30 pm' },
            { handle: 'brand.new.fan', timestamp: 'Feb 14, 2026 6:45 pm' },
          ],
          [
            { handle: 'staying.friend', timestamp: 'May 04, 2021 8:05 am' },
            { handle: 'a.brand', timestamp: 'Jan 02, 2024 1:00 pm' },
          ],
        ),
      ]),
      'April',
    );

    const state = buildCurrentState(april);
    expect(state.counts.followers).toBe(3);
    expect(state.counts.following).toBe(2);
    expect(state.counts.mutuals).toBe(1);
    expect(nonFollowers(state).map((r) => r.handle)).toEqual(['a.brand']);

    const diff = diffSnapshots(january, april);
    const followers = diff.kinds.find((k) => k.kind === 'follower')!;

    expect(followers.comparable).toBe(true);
    expect(followers.appeared.map((e) => e.handle)).toEqual(['brand.new.fan', 'new.username']);
    expect(followers.disappeared.map((e) => e.handle)).toEqual(['old.username', 'quiet.leaver']);

    // An arrival Instagram dates inside the window is a fact, not a guess.
    const fan = followers.appeared.find((e) => e.handle === 'brand.new.fan')!;
    expect(fan.evidence).toBe('confirmed_by_export');

    // A departure with no other explanation stays explicitly uncertain.
    const leaver = followers.disappeared.find((e) => e.handle === 'quiet.leaver')!;
    expect(leaver.evidence).toBe('possibly_unavailable');
    expect(leaver.statement.toLowerCase()).not.toContain('unfollowed you');

    // The rename is surfaced on both sides and only as a possibility.
    expect(diff.renames).toHaveLength(1);
    expect(diff.renames[0]).toMatchObject({ from: 'old.username', to: 'new.username' });
    expect(followers.disappeared.find((e) => e.handle === 'old.username')!.evidence).toBe(
      'possible_rename',
    );

    // Following was unchanged, and saying so is different from having no data.
    const followingDiff = diff.kinds.find((k) => k.kind === 'following')!;
    expect(followingDiff.comparable).toBe(true);
    expect(followingDiff.appeared).toEqual([]);
    expect(followingDiff.disappeared).toEqual([]);
    expect(followingDiff.unchanged).toBe(2);
  });

  it('refuses to invent departures when the later export lost a file', async () => {
    const complete = commit(
      await parseUpload([
        archive(JAN, [{ handle: 'a' }, { handle: 'b' }], [{ handle: 'x' }, { handle: 'y' }]),
      ]),
      'January',
    );
    const partial = commit(
      await parseUpload([archive(APR, [{ handle: 'a' }, { handle: 'b' }], null)]),
      'April',
    );

    expect(partial.kindsPresent).toEqual(['follower']);

    const following = diffSnapshots(complete, partial).kinds.find((k) => k.kind === 'following')!;
    expect(following.comparable).toBe(false);
    expect(following.disappeared).toEqual([]);
    expect(following.reason).toContain('April');
  });

  it('traces every observation back to the file it came from', async () => {
    const snapshot = commit(
      await parseUpload([archive(JAN, [{ handle: 'someone' }], [{ handle: 'someone' }])]),
      'January',
    );

    const row = buildCurrentState(snapshot).byHandle.get('someone')!;
    expect(row.sources.map((s) => s.sourcePath).sort()).toEqual([
      'connections/followers_and_following/followers_1.html',
      'connections/followers_and_following/following.html',
    ]);

    const timeline = buildTimeline('someone', [snapshot]);
    expect(timeline.kinds.map((k) => k.kind)).toEqual(['follower', 'following']);
    expect(timeline.kinds[0].points[0].sourcePath).toContain('followers_1.html');
  });
});
