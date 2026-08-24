import { useMemo, useState } from 'react';
import { diffSnapshots, type DiffEntry, type KindDiff } from '../analysis/diff';
import { EvidenceBadge } from '../components/EvidenceBadge';
import { Button, Callout, Card, EmptyState, SectionTitle, Select, TextInput } from '../components/ui';
import { t, useI18n } from '../i18n';
import { formatCount, formatDate } from '../lib/format';
import { listPhrase } from '../model/evidence';
import { useStore } from '../state/store';

export function ChangesScreen({
  onOpenAccount,
  onUpload,
}: {
  onOpenAccount: (handle: string) => void;
  onUpload: () => void;
}) {
  const { locale } = useI18n();
  const { snapshots, settings, dismissRename } = useStore();
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const from = snapshots.find((s) => s.id === fromId) ?? snapshots.at(-2);
  const to = snapshots.find((s) => s.id === toId) ?? snapshots.at(-1);

  const dismissed = useMemo(() => new Set(settings.dismissedRenames), [settings.dismissedRenames]);
  const diff = useMemo(
    () => (from && to && from.id !== to.id ? diffSnapshots(from, to, dismissed) : null),
    [from, to, dismissed, locale],
  );

  if (snapshots.length < 2) {
    return (
      <EmptyState
        title={t('changes.emptyTitle')}
        action={
          <Button variant="primary" onClick={onUpload}>
            {t('changes.uploadAnother')}
          </Button>
        }
      >
        {t('changes.emptyBody', { count: formatCount(snapshots.length) })}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <label className="flex flex-col gap-1 text-xs text-ink-400">
          {t('changes.earlier')}
          <Select value={from?.id ?? ''} onChange={(e) => setFromId(e.target.value)}>
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({formatDate(s.exportedAt)})
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-400">
          {t('changes.later')}
          <Select value={to?.id ?? ''} onChange={(e) => setToId(e.target.value)}>
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({formatDate(s.exportedAt)})
              </option>
            ))}
          </Select>
        </label>
        <label className="ml-auto flex flex-col gap-1 text-xs text-ink-400">
          {t('changes.search')}
          <TextInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('changes.searchPlaceholder')}
          />
        </label>
      </Card>

      {!diff ? (
        <Callout tone="warning">{t('changes.pickTwo')}</Callout>
      ) : Date.parse(diff.from.exportedAt) > Date.parse(diff.to.exportedAt) ? (
        <Callout tone="warning" title={t('changes.wrongWay')}>
          {t('changes.wrongWayBody', { from: diff.from.label, to: diff.to.label })}
        </Callout>
      ) : null}

      {diff?.renames.length ? (
        <Card className="p-4">
          <SectionTitle hint={t('changes.renamesHint')}>{t('changes.renames')}</SectionTitle>
          <ul className="space-y-2">
            {diff.renames.map((rename) => (
              <li
                key={rename.key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm"
              >
                <span className="text-amber-100">
                  {t('changes.renameBody', {
                    from: rename.from,
                    to: rename.to,
                    list: listPhrase(rename.kind),
                    date: rename.sharedTimestampRaw,
                  })}
                </span>
                <Button size="sm" variant="ghost" onClick={() => dismissRename(rename.from, rename.to)}>
                  {t('changes.notSame')}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {diff?.kinds.map((kind) => (
        <KindSection key={kind.kind} diff={kind} query={query} onOpenAccount={onOpenAccount} />
      ))}
    </div>
  );
}

function KindSection({
  diff,
  query,
  onOpenAccount,
}: {
  diff: KindDiff;
  query: string;
  onOpenAccount: (handle: string) => void;
}) {
  if (!diff.comparable) {
    return (
      <div>
        <SectionTitle>{t(`relation.${diff.kind}`)}</SectionTitle>
        <Callout tone="warning" title={t('changes.notComparable')}>
          {t('changes.notComparableBody', { reason: diff.reason ?? '' })}
        </Callout>
      </div>
    );
  }

  const needle = query.trim().toLowerCase();
  const match = (entries: DiffEntry[]) =>
    needle ? entries.filter((e) => e.handle.includes(needle)) : entries;

  const appeared = match(diff.appeared);
  const disappeared = match(diff.disappeared);
  const outOfRange = match(diff.outOfRange);

  return (
    <div>
      <SectionTitle
        hint={
          t('changes.hintUnchanged', {
            unchanged: formatCount(diff.unchanged),
            appeared: formatCount(diff.appeared.length),
            disappeared: formatCount(diff.disappeared.length),
          }) +
          (diff.outOfRange.length > 0
            ? t('changes.hintOutOfRange', { count: formatCount(diff.outOfRange.length) })
            : '')
        }
      >
        {t(`relation.${diff.kind}`)}
      </SectionTitle>

      {diff.rangeWarning ? (
        <div className="mb-3">
          <Callout tone="warning" title={t('changes.differentPeriods')}>
            {diff.rangeWarning}
          </Callout>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <EntryList
          title={t('changes.started', { count: formatCount(appeared.length) })}
          entries={appeared}
          empty={t('changes.emptyAppeared')}
          onOpenAccount={onOpenAccount}
        />
        <EntryList
          title={t('changes.stopped', { count: formatCount(disappeared.length) })}
          entries={disappeared}
          empty={t('changes.emptyDisappeared')}
          onOpenAccount={onOpenAccount}
        />
      </div>

      {diff.outOfRange.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-ink-400 hover:text-ink-200">
            {diff.outOfRange.length === 1
              ? t('changes.outOfRangeSummary', { count: formatCount(diff.outOfRange.length) })
              : t('changes.outOfRangeSummaryPlural', { count: formatCount(diff.outOfRange.length) })}
          </summary>
          <div className="mt-3">
            <EntryList
              title={t('changes.outsideRange', { count: formatCount(outOfRange.length) })}
              entries={outOfRange}
              empty={t('changes.noneMatch')}
              onOpenAccount={onOpenAccount}
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function EntryList({
  title,
  entries,
  empty,
  onOpenAccount,
}: {
  title: string;
  entries: DiffEntry[];
  empty: string;
  onOpenAccount: (handle: string) => void;
}) {
  return (
    <Card className="flex flex-col p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink-200">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-ink-500">{empty}</p>
      ) : (
        <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {entries.map((entry) => (
            <li key={entry.handle} className="rounded-lg border border-ink-800 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => onOpenAccount(entry.handle)}
                  className="font-medium text-ink-100 hover:text-violet-300 hover:underline"
                >
                  @{entry.displayHandle}
                </button>
                <EvidenceBadge level={entry.evidence} short />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-400">{entry.statement}</p>
              <p className="mt-1 font-mono text-[11px] text-ink-600">
                {t('changes.fromFile', { path: entry.sourcePath })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
