import type { Observation, RelationKind } from '../model/types';

export interface RenameSuggestion {
  kind: RelationKind;
  /** Handle that stopped appearing. */
  from: string;
  /** Handle that started appearing. */
  to: string;
  /** The follow date both entries share, exactly as the export printed it. */
  sharedTimestampRaw: string;
  /** Stable identity used to remember that the user dismissed this suggestion. */
  key: string;
}

export function renameKey(from: string, to: string): string {
  return `${from}->${to}`;
}

/**
 * The export contains no account IDs, so a username change is normally indistinguishable
 * from one account leaving and another arriving. The one usable link is the follow date:
 * Instagram keeps the original date when a username changes.
 *
 * Real exports print that date to the minute, and minutes genuinely collide - in a single
 * real followers file four accounts shared one timestamp. A shared timestamp alone is
 * therefore not evidence. A suggestion is only raised when exactly one account left and
 * exactly one arrived bearing that timestamp, which makes the pairing unambiguous.
 *
 * This remains a suggestion under any circumstances. It is never applied automatically.
 */
export function findRenameSuggestions(
  kind: RelationKind,
  disappeared: readonly Observation[],
  appeared: readonly Observation[],
): RenameSuggestion[] {
  const goneByTime = groupByTimestamp(disappeared);
  const newByTime = groupByTimestamp(appeared);

  const suggestions: RenameSuggestion[] = [];
  for (const [raw, gone] of goneByTime) {
    const arrived = newByTime.get(raw);
    if (!arrived) continue;
    if (gone.length !== 1 || arrived.length !== 1) continue;

    suggestions.push({
      kind,
      from: gone[0].handle,
      to: arrived[0].handle,
      sharedTimestampRaw: raw,
      key: renameKey(gone[0].handle, arrived[0].handle),
    });
  }

  return suggestions;
}

function groupByTimestamp(observations: readonly Observation[]): Map<string, Observation[]> {
  const groups = new Map<string, Observation[]>();
  for (const observation of observations) {
    const raw = observation.followedAtRaw;
    if (!raw) continue;
    const list = groups.get(raw) ?? [];
    list.push(observation);
    groups.set(raw, list);
  }
  return groups;
}
