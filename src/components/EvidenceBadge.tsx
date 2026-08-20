import { EVIDENCE_META, type EvidenceLevel } from '../model/evidence';
import { cx } from './ui';

const TONES = {
  positive: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  neutral: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  caution: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  warning: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
};

export function EvidenceBadge({ level, short }: { level: EvidenceLevel; short?: boolean }) {
  const meta = EVIDENCE_META[level];
  const label = short && level === 'possibly_unavailable' ? 'Cause unknown' : meta.label;

  return (
    <span
      title={meta.explanation}
      className={cx(
        'inline-block shrink-0 rounded-full border px-2 py-0.5 text-[11px] leading-4 font-medium',
        TONES[meta.tone],
      )}
    >
      {label}
    </span>
  );
}

/** The full glossary, shown wherever a reader may not know what the badges mean. */
export function EvidenceLegend() {
  return (
    <dl className="space-y-3">
      {Object.entries(EVIDENCE_META).map(([level, meta]) => (
        <div key={level} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
          <dt className="sm:w-64 sm:shrink-0">
            <EvidenceBadge level={level as EvidenceLevel} />
          </dt>
          <dd className="text-sm text-ink-400">{meta.explanation}</dd>
        </div>
      ))}
    </dl>
  );
}
