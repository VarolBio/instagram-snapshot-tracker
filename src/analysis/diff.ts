import {
  describeAppearance,
  describeDatedAppearance,
  describeDisappearance,
  describeMissingComparison,
  describePredatedAppearance,
  type EvidenceLevel,
} from '../model/evidence';
import { RELATION_KINDS, type Observation, type RelationKind, type Snapshot } from '../model/types';
import { findRenameSuggestions, type RenameSuggestion } from './rename';

export interface DiffEntry {
  handle: string;
  displayHandle: string;
  profileUrl?: string;
  followedAt?: number;
  followedAtRaw?: string;
  sourcePath: string;
  evidence: EvidenceLevel;
  statement: string;
  /** Set when this entry is one half of a plausible rename pair. */
  rename?: RenameSuggestion;
}

export interface KindDiff {
  kind: RelationKind;
  /** False when either snapshot is missing this list entirely. */
  comparable: boolean;
  /** Populated only when `comparable` is false. */
  reason?: string;
  appeared: DiffEntry[];
  disappeared: DiffEntry[];
  unchanged: number;
}

export interface SnapshotDiff {
  from: Snapshot;
  to: Snapshot;
  kinds: KindDiff[];
  renames: RenameSuggestion[];
}

/**
 * Compares two snapshots.
 *
 * The rule that matters most is the comparability check. If a snapshot simply did not
 * contain a list - a failed upload, a partial export, a user who only exported followers -
 * then every account in that list would otherwise look like it had vanished. Refusing to
 * compare is the difference between a useful tool and one that invents a crisis.
 */
export function diffSnapshots(
  from: Snapshot,
  to: Snapshot,
  dismissedRenames: ReadonlySet<string> = new Set(),
): SnapshotDiff {
  const relevant = RELATION_KINDS.filter(
    (kind) => from.kindsPresent.includes(kind) || to.kindsPresent.includes(kind),
  );

  const kinds: KindDiff[] = [];
  const renames: RenameSuggestion[] = [];

  for (const kind of relevant) {
    const inFrom = from.kindsPresent.includes(kind);
    const inTo = to.kindsPresent.includes(kind);

    if (!inFrom || !inTo) {
      kinds.push({
        kind,
        comparable: false,
        reason: describeMissingComparison(kind, inFrom ? to.label : from.label),
        appeared: [],
        disappeared: [],
        unchanged: 0,
      });
      continue;
    }

    const before = indexOf(from, kind);
    const after = indexOf(to, kind);

    const goneObs = [...before.values()].filter((o) => !after.has(o.handle));
    const newObs = [...after.values()].filter((o) => !before.has(o.handle));
    const unchanged = [...before.keys()].filter((h) => after.has(h)).length;

    const suggestions = findRenameSuggestions(kind, goneObs, newObs).filter(
      (s) => !dismissedRenames.has(s.key),
    );
    renames.push(...suggestions);

    const renameByFrom = new Map(suggestions.map((s) => [s.from, s]));
    const renameByTo = new Map(suggestions.map((s) => [s.to, s]));

    kinds.push({
      kind,
      comparable: true,
      appeared: newObs
        .map((o) => describeArrival(o, kind, from, to, renameByTo.get(o.handle)))
        .sort(byHandle),
      disappeared: goneObs
        .map((o) => describeDeparture(o, kind, from, to, renameByFrom.get(o.handle)))
        .sort(byHandle),
      unchanged,
    });
  }

  return { from, to, kinds, renames };
}

function describeArrival(
  observation: Observation,
  kind: RelationKind,
  from: Snapshot,
  to: Snapshot,
  rename: RenameSuggestion | undefined,
): DiffEntry {
  const windowStart = Date.parse(from.exportedAt);
  const windowEnd = Date.parse(to.exportedAt);
  const followedAt = observation.followedAt;

  let evidence: EvidenceLevel = 'likely_change';
  let statement = describeAppearance(kind, from.exportedAt, to.exportedAt);

  if (followedAt !== undefined && followedAt >= windowStart && followedAt <= windowEnd) {
    // The export names the date outright, so this is no longer an inference.
    evidence = 'confirmed_by_export';
    statement = describeDatedAppearance(kind, followedAt);
  } else if (followedAt !== undefined && followedAt < windowStart) {
    statement = describePredatedAppearance(kind, followedAt, from.label);
  }

  if (rename) {
    evidence = 'possible_rename';
    statement = `${statement} It shares a follow date with @${rename.from}, which stopped appearing over the same period, so this may be that account renamed.`;
  }

  return { ...toEntry(observation), evidence, statement, rename };
}

function describeDeparture(
  observation: Observation,
  kind: RelationKind,
  from: Snapshot,
  to: Snapshot,
  rename: RenameSuggestion | undefined,
): DiffEntry {
  let evidence: EvidenceLevel = 'possibly_unavailable';
  let statement = describeDisappearance(kind, from.exportedAt, to.exportedAt);

  if (rename) {
    evidence = 'possible_rename';
    statement = `${statement} It shares a follow date with @${rename.to}, which started appearing over the same period, so this may be the same account renamed.`;
  }

  return { ...toEntry(observation), evidence, statement, rename };
}

function toEntry(observation: Observation) {
  return {
    handle: observation.handle,
    displayHandle: observation.displayHandle,
    profileUrl: observation.profileUrl,
    followedAt: observation.followedAt,
    followedAtRaw: observation.followedAtRaw,
    sourcePath: observation.sourcePath,
  };
}

function indexOf(snapshot: Snapshot, kind: RelationKind): Map<string, Observation> {
  const map = new Map<string, Observation>();
  for (const observation of snapshot.observations) {
    if (observation.kind === kind) map.set(observation.handle, observation);
  }
  return map;
}

function byHandle(a: DiffEntry, b: DiffEntry): number {
  return a.handle.localeCompare(b.handle);
}
