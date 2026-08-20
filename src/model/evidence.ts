/**
 * Every claim the UI makes carries one of these levels, and the wording for each
 * claim is produced here rather than in the screens. Centralising the phrasing is
 * what keeps words like "unfollowed" out of the interface: an export can prove
 * that someone stopped appearing in a list, never why.
 */

import type { RelationKind } from './types';
import { formatDate } from '../lib/format';

export type EvidenceLevel =
  | 'confirmed_by_export'
  | 'likely_change'
  | 'possible_rename'
  | 'possibly_unavailable'
  | 'insufficient_evidence';

export interface EvidenceMeta {
  label: string;
  /** What this level actually means, shown on hover and in the limitations panel. */
  explanation: string;
  tone: 'positive' | 'neutral' | 'caution' | 'warning';
}

export const EVIDENCE_META: Record<EvidenceLevel, EvidenceMeta> = {
  confirmed_by_export: {
    label: 'Confirmed by export',
    explanation:
      'This account is listed in a file you uploaded. The source file is named alongside the entry.',
    tone: 'positive',
  },
  likely_change: {
    label: 'Likely change',
    explanation:
      'Two snapshots disagree, and both snapshots contained the list being compared, so the change is well supported. The exact moment it happened is still unknown.',
    tone: 'neutral',
  },
  possible_rename: {
    label: 'Possible rename',
    explanation:
      'One account disappeared and another appeared sharing exactly the same follow timestamp, and no other account shares it. Instagram keeps the original follow date when a username changes, so this may be one account under a new name. It is a suggestion, never a confirmation.',
    tone: 'caution',
  },
  possibly_unavailable: {
    label: 'Possibly deleted, deactivated, renamed, or unavailable',
    explanation:
      'The account stopped appearing in the list. It may have unfollowed, changed username, been deleted, been deactivated, blocked you, or simply been omitted from an incomplete export. The export cannot tell these apart.',
    tone: 'warning',
  },
  insufficient_evidence: {
    label: 'Insufficient evidence',
    explanation:
      'There is not enough data to say anything. Usually this means only one snapshot exists, or one of the two snapshots did not contain the list being compared.',
    tone: 'warning',
  },
};

/** Natural-language name for a list, used inside sentences. */
const LIST_PHRASE: Record<RelationKind, string> = {
  follower: 'your followers',
  following: 'the accounts you follow',
  pending_outgoing: 'your sent follow requests',
  pending_incoming: 'your received follow requests',
  recently_unfollowed: 'your recently unfollowed list',
  close_friend: 'your close friends',
  blocked: 'your blocked list',
  restricted: 'your restricted list',
  hidden_story_from: 'your story-hidden list',
};

export function listPhrase(kind: RelationKind): string {
  return LIST_PHRASE[kind];
}

export function describeAppearance(kind: RelationKind, from: string, to: string): string {
  return `Started appearing in ${LIST_PHRASE[kind]} between ${formatDate(from)} and ${formatDate(to)}.`;
}

export function describeDisappearance(kind: RelationKind, from: string, to: string): string {
  return `Stopped appearing in ${LIST_PHRASE[kind]} between ${formatDate(from)} and ${formatDate(to)}.`;
}

/**
 * When the export gives a follow date that falls inside the comparison window, the
 * appearance stops being an inference and becomes a date the export states outright.
 */
export function describeDatedAppearance(kind: RelationKind, followedAt: number): string {
  return `The export records this account joining ${LIST_PHRASE[kind]} on ${formatDate(followedAt)}.`;
}

/**
 * An account whose stated follow date predates the earlier snapshot, yet which was
 * absent from it, is evidence that the earlier export was incomplete. Saying so is
 * more useful than pretending the account is new.
 */
export function describePredatedAppearance(
  kind: RelationKind,
  followedAt: number,
  earlierLabel: string,
): string {
  return (
    `The export records this account joining ${LIST_PHRASE[kind]} on ${formatDate(followedAt)}, ` +
    `which is before "${earlierLabel}" was taken. That earlier export was probably incomplete rather than this being a new arrival.`
  );
}

export function describeMissingComparison(kind: RelationKind, missingIn: string): string {
  return `"${missingIn}" does not contain ${LIST_PHRASE[kind]}, so no comparison is possible for this list.`;
}
