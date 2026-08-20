import type { Observation, RelationKind, Snapshot } from '../model/types';

export interface AccountRow {
  handle: string;
  displayHandle: string;
  profileUrl?: string;
  isFollower: boolean;
  isFollowing: boolean;
  /** When the export says they started following you. */
  followedYouAt?: number;
  /** When the export says you started following them. */
  youFollowedAt?: number;
  /** Every list this account appears in, with the file that proves it. */
  sources: { kind: RelationKind; sourcePath: string }[];
}

export interface CurrentStateCounts {
  followers: number;
  following: number;
  mutuals: number;
  notFollowingBack: number;
  youDoNotFollowBack: number;
}

export interface CurrentState {
  rows: AccountRow[];
  byHandle: Map<string, AccountRow>;
  counts: CurrentStateCounts;
}

export function sortSnapshots(snapshots: readonly Snapshot[]): Snapshot[] {
  return [...snapshots].sort((a, b) => Date.parse(a.exportedAt) - Date.parse(b.exportedAt));
}

export function latestSnapshot(snapshots: readonly Snapshot[]): Snapshot | undefined {
  return sortSnapshots(snapshots).at(-1);
}

export function observationsOfKind(snapshot: Snapshot, kind: RelationKind): Observation[] {
  return snapshot.observations.filter((o) => o.kind === kind);
}

/**
 * Folds one snapshot into one row per account. Everything here is a restatement of
 * what a single export contains, so every field is directly confirmed by that export.
 */
export function buildCurrentState(snapshot: Snapshot | undefined): CurrentState {
  const byHandle = new Map<string, AccountRow>();
  if (!snapshot) {
    return {
      rows: [],
      byHandle,
      counts: {
        followers: 0,
        following: 0,
        mutuals: 0,
        notFollowingBack: 0,
        youDoNotFollowBack: 0,
      },
    };
  }

  for (const observation of snapshot.observations) {
    let row = byHandle.get(observation.handle);
    if (!row) {
      row = {
        handle: observation.handle,
        displayHandle: observation.displayHandle,
        profileUrl: observation.profileUrl,
        isFollower: false,
        isFollowing: false,
        sources: [],
      };
      byHandle.set(observation.handle, row);
    }

    row.sources.push({ kind: observation.kind, sourcePath: observation.sourcePath });

    if (observation.kind === 'follower') {
      row.isFollower = true;
      row.followedYouAt = observation.followedAt;
    } else if (observation.kind === 'following') {
      row.isFollowing = true;
      row.youFollowedAt = observation.followedAt;
    }
  }

  const rows = [...byHandle.values()].sort((a, b) => a.handle.localeCompare(b.handle));

  return {
    rows,
    byHandle,
    counts: {
      followers: rows.filter((r) => r.isFollower).length,
      following: rows.filter((r) => r.isFollowing).length,
      mutuals: rows.filter((r) => r.isFollower && r.isFollowing).length,
      notFollowingBack: rows.filter((r) => r.isFollowing && !r.isFollower).length,
      youDoNotFollowBack: rows.filter((r) => r.isFollower && !r.isFollowing).length,
    },
  };
}

/** Accounts you follow who are not in your followers list in this same export. */
export function nonFollowers(state: CurrentState): AccountRow[] {
  return state.rows.filter((r) => r.isFollowing && !r.isFollower);
}
