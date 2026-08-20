import {
  describeAppearance,
  describeDatedAppearance,
  describeDisappearance,
  type EvidenceLevel,
} from '../model/evidence';
import { RELATION_KINDS, type Observation, type RelationKind, type Snapshot } from '../model/types';
import { sortSnapshots } from './currentState';

export interface TimelinePoint {
  snapshotId: string;
  label: string;
  exportedAt: string;
  /** False when this snapshot did not include the list at all - a gap, not an absence. */
  covered: boolean;
  present: boolean;
  sourcePath?: string;
  followedAtRaw?: string;
}

export interface KindTimeline {
  kind: RelationKind;
  points: TimelinePoint[];
}

export interface TimelineEvent {
  kind: RelationKind;
  type: 'appeared' | 'disappeared';
  fromLabel: string;
  toLabel: string;
  at: string;
  evidence: EvidenceLevel;
  statement: string;
}

export interface AccountTimeline {
  handle: string;
  displayHandle: string;
  profileUrl?: string;
  firstSeen?: string;
  lastSeen?: string;
  kinds: KindTimeline[];
  events: TimelineEvent[];
}

/**
 * The full history of one account across every snapshot.
 *
 * A snapshot that never contained the list is recorded as a gap rather than as an
 * absence, so the timeline cannot imply someone left during a period we never observed.
 */
export function buildTimeline(handle: string, snapshots: readonly Snapshot[]): AccountTimeline {
  const ordered = sortSnapshots(snapshots);
  const lookup = ordered.map((snapshot) => ({
    snapshot,
    observations: indexByKind(snapshot, handle),
  }));

  const seenKinds = RELATION_KINDS.filter((kind) =>
    lookup.some((entry) => entry.observations.has(kind)),
  );

  const kinds: KindTimeline[] = seenKinds.map((kind) => ({
    kind,
    points: lookup.map(({ snapshot, observations }) => {
      const observation = observations.get(kind);
      return {
        snapshotId: snapshot.id,
        label: snapshot.label,
        exportedAt: snapshot.exportedAt,
        covered: snapshot.kindsPresent.includes(kind),
        present: observation !== undefined,
        sourcePath: observation?.sourcePath,
        followedAtRaw: observation?.followedAtRaw,
      };
    }),
  }));

  const events: TimelineEvent[] = [];
  for (const { kind, points } of kinds) {
    for (let i = 1; i < points.length; i++) {
      const before = points[i - 1];
      const after = points[i];
      if (!before.covered || !after.covered) continue;
      if (before.present === after.present) continue;

      const observation = lookup[i].observations.get(kind) ?? lookup[i - 1].observations.get(kind);
      events.push(
        after.present
          ? arrivalEvent(kind, before, after, observation)
          : {
              kind,
              type: 'disappeared',
              fromLabel: before.label,
              toLabel: after.label,
              at: after.exportedAt,
              evidence: 'possibly_unavailable',
              statement: describeDisappearance(kind, before.exportedAt, after.exportedAt),
            },
      );
    }
  }

  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const present = lookup.filter((entry) => entry.observations.size > 0);
  const anyObservation = present.at(0)?.observations.values().next().value;

  return {
    handle,
    displayHandle: anyObservation?.displayHandle ?? handle,
    profileUrl: anyObservation?.profileUrl ?? `https://www.instagram.com/${handle}`,
    firstSeen: present.at(0)?.snapshot.exportedAt,
    lastSeen: present.at(-1)?.snapshot.exportedAt,
    kinds,
    events,
  };
}

function arrivalEvent(
  kind: RelationKind,
  before: TimelinePoint,
  after: TimelinePoint,
  observation: Observation | undefined,
): TimelineEvent {
  const followedAt = observation?.followedAt;
  const inWindow =
    followedAt !== undefined &&
    followedAt >= Date.parse(before.exportedAt) &&
    followedAt <= Date.parse(after.exportedAt);

  return {
    kind,
    type: 'appeared',
    fromLabel: before.label,
    toLabel: after.label,
    at: after.exportedAt,
    evidence: inWindow ? 'confirmed_by_export' : 'likely_change',
    statement: inWindow
      ? describeDatedAppearance(kind, followedAt)
      : describeAppearance(kind, before.exportedAt, after.exportedAt),
  };
}

function indexByKind(snapshot: Snapshot, handle: string): Map<RelationKind, Observation> {
  const map = new Map<RelationKind, Observation>();
  for (const observation of snapshot.observations) {
    if (observation.handle === handle) map.set(observation.kind, observation);
  }
  return map;
}

export interface AccountSummary {
  handle: string;
  displayHandle: string;
  snapshotCount: number;
  lastSeen: string;
}

/** Every account ever observed, for the global search box. */
export function listAllAccounts(snapshots: readonly Snapshot[]): AccountSummary[] {
  const summaries = new Map<string, AccountSummary>();

  for (const snapshot of sortSnapshots(snapshots)) {
    const seenHere = new Set<string>();
    for (const observation of snapshot.observations) {
      if (seenHere.has(observation.handle)) continue;
      seenHere.add(observation.handle);

      const existing = summaries.get(observation.handle);
      if (existing) {
        existing.snapshotCount++;
        existing.lastSeen = snapshot.exportedAt;
      } else {
        summaries.set(observation.handle, {
          handle: observation.handle,
          displayHandle: observation.displayHandle,
          snapshotCount: 1,
          lastSeen: snapshot.exportedAt,
        });
      }
    }
  }

  return [...summaries.values()].sort((a, b) => a.handle.localeCompare(b.handle));
}
