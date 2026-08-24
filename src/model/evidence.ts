/**
 * Every claim the UI makes carries one of these levels, and the wording for each
 * claim is produced here rather than in the screens. Centralising the phrasing is
 * what keeps words like "unfollowed" out of the interface: an export can prove
 * that someone stopped appearing in a list, never why.
 */

import { t } from '../i18n';
import { formatDate } from '../lib/format';
import type { RelationKind } from './types';

export type EvidenceLevel =
  | 'confirmed_by_export'
  | 'likely_change'
  | 'possible_rename'
  | 'possibly_unavailable'
  | 'insufficient_evidence';

export interface EvidenceMeta {
  label: string;
  explanation: string;
  tone: 'positive' | 'neutral' | 'caution' | 'warning';
}

const TONES: Record<EvidenceLevel, EvidenceMeta['tone']> = {
  confirmed_by_export: 'positive',
  likely_change: 'neutral',
  possible_rename: 'caution',
  possibly_unavailable: 'warning',
  insufficient_evidence: 'warning',
};

export function evidenceMeta(level: EvidenceLevel): EvidenceMeta {
  return {
    label: t(`evidence.${level}.label`),
    explanation: t(`evidence.${level}.explanation`),
    tone: TONES[level],
  };
}

export function listPhrase(kind: RelationKind): string {
  return t(`listPhrase.${kind}`);
}

export function describeAppearance(kind: RelationKind, from: string, to: string): string {
  return t('evidenceText.appearance', { list: listPhrase(kind), from: formatDate(from), to: formatDate(to) });
}

export function describeDisappearance(kind: RelationKind, from: string, to: string): string {
  return t('evidenceText.disappearance', { list: listPhrase(kind), from: formatDate(from), to: formatDate(to) });
}

export function describeDatedAppearance(kind: RelationKind, followedAt: number): string {
  return t('evidenceText.datedAppearance', { list: listPhrase(kind), date: formatDate(followedAt) });
}

export function describePredatedAppearance(
  kind: RelationKind,
  followedAt: number,
  earlierLabel: string,
): string {
  return t('evidenceText.predatedAppearance', {
    list: listPhrase(kind),
    date: formatDate(followedAt),
    label: earlierLabel,
  });
}

export function describeMissingComparison(kind: RelationKind, missingIn: string): string {
  return t('evidenceText.missingComparison', { label: missingIn, list: listPhrase(kind) });
}

export function describeOutOfRange(
  laterLabel: string,
  windowStart: string,
  followedAt: number | undefined,
): string {
  if (followedAt === undefined) {
    return t('evidenceText.outOfRangeNoDate', { label: laterLabel, window: formatDate(windowStart) });
  }
  return t('evidenceText.outOfRange', {
    date: formatDate(followedAt),
    label: laterLabel,
    window: formatDate(windowStart),
  });
}

export function describeRangeMismatch(
  kind: RelationKind,
  laterLabel: string,
  windowStart: string,
  affected: number,
): string {
  return t('evidenceText.rangeMismatch', {
    label: laterLabel,
    window: formatDate(windowStart),
    list: listPhrase(kind),
    affected: String(affected),
    accounts: affected === 1 ? t('evidenceText.accountsOne') : t('evidenceText.accountsMany'),
    pronoun: affected === 1 ? t('evidenceText.pronounOne') : t('evidenceText.pronounMany'),
  });
}
