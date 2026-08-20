import { describe, expect, it } from 'vitest';
import { buildCurrentState, nonFollowers } from '../src/analysis/currentState';
import { diffSnapshots } from '../src/analysis/diff';
import { findRenameSuggestions } from '../src/analysis/rename';
import { buildTimeline, listAllAccounts } from '../src/analysis/timeline';
import {
  PARSER_VERSION,
  type Observation,
  type RelationKind,
  type Snapshot,
} from '../src/model/types';

interface Spec {
  followers?: (string | [string, string])[];
  following?: (string | [string, string])[];
  /** Lists this export actually contained; defaults to whichever keys were supplied. */
  kindsPresent?: RelationKind[];
}

function observation(entry: string | [string, string], kind: RelationKind): Observation {
  const [handle, followedAtRaw] = Array.isArray(entry) ? entry : [entry, undefined];
  return {
    handle,
    displayHandle: handle,
    kind,
    followedAtRaw,
    followedAt: followedAtRaw ? Date.parse(`${followedAtRaw}Z`) : undefined,
    profileUrl: `https://www.instagram.com/${handle}`,
    sourcePath: kind === 'follower' ? 'followers_1.html' : 'following.html',
  };
}

function snapshot(id: string, exportedAt: string, spec: Spec): Snapshot {
  const observations = [
    ...(spec.followers ?? []).map((e) => observation(e, 'follower')),
    ...(spec.following ?? []).map((e) => observation(e, 'following')),
  ];
  const inferred: RelationKind[] = [];
  if (spec.followers) inferred.push('follower');
  if (spec.following) inferred.push('following');

  return {
    id,
    label: id,
    exportedAt,
    exportedAtSource: 'document_header',
    importedAt: exportedAt,
    parserVersion: PARSER_VERSION,
    sourceFiles: [],
    kindsPresent: spec.kindsPresent ?? inferred,
    warnings: [],
    observations,
    contentHash: id,
  };
}

describe('current state from a single snapshot', () => {
  const snap = snapshot('jan', '2026-01-01T00:00:00.000Z', {
    followers: ['mutual', 'fan'],
    following: ['mutual', 'idol'],
  });

  it('counts each relationship', () => {
    const state = buildCurrentState(snap);
    expect(state.counts).toEqual({
      followers: 2,
      following: 2,
      mutuals: 1,
      notFollowingBack: 1,
      youDoNotFollowBack: 1,
    });
  });

  it('lists accounts you follow who do not follow you back', () => {
    expect(nonFollowers(buildCurrentState(snap)).map((r) => r.handle)).toEqual(['idol']);
  });

  it('keeps the source file for every account', () => {
    const mutual = buildCurrentState(snap).byHandle.get('mutual')!;
    expect(mutual.sources.map((s) => s.sourcePath).sort()).toEqual([
      'followers_1.html',
      'following.html',
    ]);
  });

  it('handles having no snapshots at all', () => {
    expect(buildCurrentState(undefined).counts.followers).toBe(0);
  });
});

describe('comparing two snapshots', () => {
  const jan = snapshot('January', '2026-01-01T00:00:00.000Z', {
    followers: ['stays', 'leaves'],
    following: ['stays'],
  });
  const mar = snapshot('March', '2026-03-01T00:00:00.000Z', {
    followers: ['stays', 'arrives'],
    following: ['stays'],
  });

  it('separates arrivals from departures', () => {
    const followers = diffSnapshots(jan, mar).kinds.find((k) => k.kind === 'follower')!;
    expect(followers.appeared.map((e) => e.handle)).toEqual(['arrives']);
    expect(followers.disappeared.map((e) => e.handle)).toEqual(['leaves']);
    expect(followers.unchanged).toBe(1);
  });

  it('never claims someone unfollowed', () => {
    const followers = diffSnapshots(jan, mar).kinds.find((k) => k.kind === 'follower')!;
    const gone = followers.disappeared[0];
    expect(gone.evidence).toBe('possibly_unavailable');
    expect(gone.statement).toContain('Stopped appearing in your followers');
    expect(gone.statement.toLowerCase()).not.toContain('unfollow');
  });

  it('states an arrival as a fact when the export dates it inside the window', () => {
    const before = snapshot('January', '2026-01-01T00:00:00.000Z', { followers: [] });
    const after = snapshot('March', '2026-03-01T00:00:00.000Z', {
      followers: [['newbie', 'Feb 02, 2026 10:00:00']],
    });
    const entry = diffSnapshots(before, after).kinds[0].appeared[0];
    expect(entry.evidence).toBe('confirmed_by_export');
    expect(entry.statement).toContain('The export records this account joining');
  });

  it('points at an incomplete earlier export when a follow date predates it', () => {
    const before = snapshot('January', '2026-01-01T00:00:00.000Z', { followers: [] });
    const after = snapshot('March', '2026-03-01T00:00:00.000Z', {
      followers: [['oldtimer', 'Mar 05, 2019 10:00:00']],
    });
    const entry = diffSnapshots(before, after).kinds[0].appeared[0];
    expect(entry.evidence).toBe('likely_change');
    expect(entry.statement).toContain('probably incomplete');
  });
});

describe('the guardrail against invented disappearances', () => {
  const complete = snapshot('January', '2026-01-01T00:00:00.000Z', {
    followers: ['a', 'b', 'c'],
    following: ['a', 'b', 'c'],
  });
  /** A partial upload: the following file failed to parse, so the list is absent. */
  const partial = snapshot('March', '2026-03-01T00:00:00.000Z', {
    followers: ['a', 'b', 'c'],
    kindsPresent: ['follower'],
  });

  it('refuses to compare a list one snapshot never contained', () => {
    const following = diffSnapshots(complete, partial).kinds.find((k) => k.kind === 'following')!;
    expect(following.comparable).toBe(false);
    expect(following.disappeared).toHaveLength(0);
    expect(following.appeared).toHaveLength(0);
  });

  it('names the snapshot that is missing the list', () => {
    const following = diffSnapshots(complete, partial).kinds.find((k) => k.kind === 'following')!;
    expect(following.reason).toContain('March');
    expect(following.reason).toContain('no comparison is possible');
  });

  it('still compares the lists both snapshots do have', () => {
    const followers = diffSnapshots(complete, partial).kinds.find((k) => k.kind === 'follower')!;
    expect(followers.comparable).toBe(true);
    expect(followers.unchanged).toBe(3);
  });

  it('works in the other direction too', () => {
    const following = diffSnapshots(partial, complete).kinds.find((k) => k.kind === 'following')!;
    expect(following.comparable).toBe(false);
    expect(following.appeared).toHaveLength(0);
  });
});

describe('rename suggestions', () => {
  const gone = (handle: string, raw: string) => observation([handle, raw], 'follower');

  it('pairs a departure and an arrival that share one unique follow date', () => {
    const suggestions = findRenameSuggestions(
      'follower',
      [gone('old.name', 'Aug 01, 2026 9:09 am')],
      [gone('new.name', 'Aug 01, 2026 9:09 am')],
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ from: 'old.name', to: 'new.name' });
  });

  it('stays silent when the timestamp is shared by more than one account', () => {
    // Real exports print minutes, and four accounts shared one minute in a real file.
    const suggestions = findRenameSuggestions(
      'follower',
      [gone('gone.a', 'Jul 17, 2026 2:04 am'), gone('gone.b', 'Jul 17, 2026 2:04 am')],
      [gone('new.a', 'Jul 17, 2026 2:04 am')],
    );
    expect(suggestions).toEqual([]);
  });

  it('stays silent when there are no timestamps', () => {
    expect(
      findRenameSuggestions(
        'follower',
        [observation('old', 'follower')],
        [observation('new', 'follower')],
      ),
    ).toEqual([]);
  });

  it('labels both halves of the pair and can be dismissed', () => {
    const before = snapshot('January', '2026-01-01T00:00:00.000Z', {
      followers: [['old.name', 'Aug 01, 2020 9:09:00']],
    });
    const after = snapshot('March', '2026-03-01T00:00:00.000Z', {
      followers: [['new.name', 'Aug 01, 2020 9:09:00']],
    });

    const diff = diffSnapshots(before, after);
    expect(diff.renames).toHaveLength(1);
    expect(diff.kinds[0].appeared[0].evidence).toBe('possible_rename');
    expect(diff.kinds[0].disappeared[0].evidence).toBe('possible_rename');

    const dismissed = diffSnapshots(before, after, new Set(['old.name->new.name']));
    expect(dismissed.renames).toEqual([]);
    expect(dismissed.kinds[0].disappeared[0].evidence).toBe('possibly_unavailable');
  });
});

describe('account timelines', () => {
  const jan = snapshot('January', '2026-01-01T00:00:00.000Z', { followers: ['alex'] });
  const feb = snapshot('February', '2026-02-01T00:00:00.000Z', { followers: [] });
  const mar = snapshot('March', '2026-03-01T00:00:00.000Z', { followers: ['alex'] });

  it('records presence at every snapshot in date order', () => {
    const timeline = buildTimeline('alex', [mar, jan, feb]);
    expect(timeline.kinds[0].points.map((p) => p.present)).toEqual([true, false, true]);
    expect(timeline.kinds[0].points.map((p) => p.label)).toEqual([
      'January',
      'February',
      'March',
    ]);
  });

  it('describes each transition without asserting a cause', () => {
    const timeline = buildTimeline('alex', [jan, feb, mar]);
    expect(timeline.events.map((e) => e.type)).toEqual(['disappeared', 'appeared']);
    expect(timeline.events[0].statement).toContain('Stopped appearing');
  });

  it('treats an uncovered list as a gap rather than an absence', () => {
    const noFollowers = snapshot('February', '2026-02-01T00:00:00.000Z', {
      following: [],
      kindsPresent: ['following'],
    });
    const timeline = buildTimeline('alex', [jan, noFollowers, mar]);
    const points = timeline.kinds.find((k) => k.kind === 'follower')!.points;
    expect(points[1].covered).toBe(false);
    expect(timeline.events).toHaveLength(0);
  });

  it('collects every account ever seen for search', () => {
    const all = listAllAccounts([jan, feb, mar]);
    expect(all.map((a) => a.handle)).toEqual(['alex']);
    expect(all[0].snapshotCount).toBe(2);
    expect(all[0].lastSeen).toBe('2026-03-01T00:00:00.000Z');
  });
});
