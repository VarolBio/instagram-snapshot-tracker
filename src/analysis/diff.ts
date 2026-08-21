import {
  describeAppearance,
  describeDatedAppearance,
  describeDisappearance,
  describeMissingComparison,
  describeOutOfRange,
  describePredatedAppearance,
  describeRangeMismatch,
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
  /**
   * Accounts absent from the later snapshot only because its export was requested for a
   * date range that predates them. Held separately so they never inflate `disappeared`.
   */
  outOfRange: DiffEntry[];
  /** Set when the later export's date range makes this comparison partial. */
  rangeWarning?: string;
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
        outOfRange: [],
        unchanged: 0,
      });
      continue;
    }

    const before = indexOf(from, kind);
    const after = indexOf(to, kind);

    const allGone = [...before.values()].filter((o) => !after.has(o.handle));
    const newObs = [...after.values()].filter((o) => !before.has(o.handle));
    const unchanged = [...before.keys()].filter((h) => after.has(h)).length;

    const windowStart = trimmedWindowStart(to, kind, allGone);
    const goneObs =
      windowStart === null ? allGone : allGone.filter((o) => couldAppearIn(o, windowStart));
    const beyondRange =
      windowStart === null ? [] : allGone.filter((o) => !couldAppearIn(o, windowStart));

    // Renames are matched only among accounts the later export could actually have listed;
    // pairing against an account the date range excluded would be meaningless.
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
      outOfRange: beyondRange
        .map((o) => ({
          ...toEntry(o),
          evidence: 'insufficient_evidence' as const,
          statement: describeOutOfRange(to.label, windowStart!, o.followedAt),
        }))
        .sort(byHandle),
      rangeWarning:
        beyondRange.length > 0
          ? describeRangeMismatch(kind, to.label, windowStart!, beyondRange.length)
          : undefined,
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

/**
 * Decides whether the later export's date range trimmed this list, and returns the start
 * of that range if so.
 *
 * An export can be requested for a limited period, and Instagram then lists only the
 * accounts acquired within it. Comparing an all-time export against a two-month one would
 * otherwise put every long-standing follower in the "gone" column.
 *
 * The test is self-evidencing rather than a guess. A list that kept entries older than its
 * own window proves the range was never applied to it, so its absences are real - this is
 * exactly how the following list behaves in real exports, while the followers list beside
 * it gets trimmed. And a range is only invoked when it actually explains a dated account
 * that went missing, so a wide window over a genuinely complete export changes nothing.
 */
function trimmedWindowStart(
  to: Snapshot,
  kind: RelationKind,
  missing: readonly Observation[],
): string | null {
  if (!to.coverage) return null;
  const windowStart = Date.parse(to.coverage.from);
  if (Number.isNaN(windowStart)) return null;

  const keptOlderEntries = to.observations.some(
    (o) => o.kind === kind && o.followedAt !== undefined && o.followedAt < windowStart,
  );
  if (keptOlderEntries) return null;

  const rangeExplainsSomeone = missing.some(
    (o) => o.followedAt !== undefined && o.followedAt < windowStart,
  );
  return rangeExplainsSomeone ? to.coverage.from : null;
}

/** Whether the later export could have listed this account at all, given its date range. */
function couldAppearIn(observation: Observation, windowStart: string): boolean {
  // No follow date means no way to place the account relative to the range. Once the list
  // is known to be trimmed, treating that as unverifiable beats guessing at a departure.
  if (observation.followedAt === undefined) return false;
  return observation.followedAt >= Date.parse(windowStart);
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
