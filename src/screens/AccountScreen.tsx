import { useMemo, useState } from 'react';
import { buildTimeline, listAllAccounts } from '../analysis/timeline';
import { OpenProfileLink } from '../components/AccountTable';
import { EvidenceBadge } from '../components/EvidenceBadge';
import { Button, Callout, Card, EmptyState, SectionTitle, Select, TextInput, cx } from '../components/ui';
import { t, useI18n } from '../i18n';
import { formatCount, formatDate } from '../lib/format';
import { type AccountCategory } from '../model/types';
import { useStore } from '../state/store';

export function AccountScreen({
  handle,
  onOpenAccount,
  onUpload,
}: {
  handle: string | null;
  onOpenAccount: (handle: string) => void;
  onUpload: () => void;
}) {
  const { locale } = useI18n();
  const { snapshots, settings, classify } = useStore();
  const [query, setQuery] = useState('');

  const accounts = useMemo(() => listAllAccounts(snapshots), [snapshots]);
  const timeline = useMemo(
    () => (handle ? buildTimeline(handle, snapshots) : null),
    [handle, snapshots, locale],
  );

  if (snapshots.length === 0) {
    return (
      <EmptyState
        title={t('accounts.emptyTitle')}
        action={
          <Button variant="primary" onClick={onUpload}>
            {t('current.upload')}
          </Button>
        }
      >
        {t('accounts.emptyBody')}
      </EmptyState>
    );
  }

  if (!timeline) {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? accounts.filter((a) => a.handle.includes(needle)).slice(0, 60)
      : accounts.slice(0, 60);

    return (
      <div className="space-y-4">
        <SectionTitle hint={t('accounts.everSeen', { count: formatCount(accounts.length) })}>
          {t('accounts.lookup')}
        </SectionTitle>
        <TextInput
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('accounts.searchPlaceholder')}
          className="w-full"
          autoFocus
        />
        <Card className="divide-y divide-ink-800/60">
          {matches.map((account) => (
            <button
              key={account.handle}
              onClick={() => onOpenAccount(account.handle)}
              className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-ink-800/40"
            >
              <span className="font-medium text-ink-100">@{account.displayHandle}</span>
              <span className="text-xs text-ink-500">
                {t('accounts.seenIn', {
                  seen: formatCount(account.snapshotCount),
                  total: formatCount(snapshots.length),
                  date: formatDate(account.lastSeen),
                })}
              </span>
            </button>
          ))}
          {matches.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-500">{t('accounts.noMatch')}</p>
          ) : null}
        </Card>
        {accounts.length > matches.length && !needle ? (
          <p className="text-xs text-ink-500">
            {t('accounts.showingFirst', { count: formatCount(matches.length) })}
          </p>
        ) : null}
      </div>
    );
  }

  const category = settings.classifications[timeline.handle]?.category ?? 'unknown';

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div>
          <h2 className="text-xl font-semibold text-ink-50">@{timeline.displayHandle}</h2>
          <p className="mt-1 text-sm text-ink-400">
            {t('accounts.firstLast', {
              first: formatDate(timeline.firstSeen),
              last: formatDate(timeline.lastSeen),
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={category}
            onChange={(e) => classify(timeline.handle, e.target.value as AccountCategory)}
            aria-label={t('accounts.category')}
          >
            {(['personal', 'creator', 'business', 'unknown'] as AccountCategory[]).map((c) => (
              <option key={c} value={c}>
                {t(`category.${c}`)}
              </option>
            ))}
          </Select>
          <OpenProfileLink handle={timeline.handle} />
        </div>
      </Card>

      <div>
        <SectionTitle hint={t('accounts.presenceHint')}>{t('accounts.presence')}</SectionTitle>
        <div className="space-y-3">
          {timeline.kinds.map(({ kind, points }) => (
            <Card key={kind} className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-ink-200">{t(`relation.${kind}`)}</h3>
              <ol className="flex flex-wrap gap-2">
                {points.map((point) => (
                  <li
                    key={point.snapshotId}
                    title={
                      !point.covered
                        ? t('accounts.notInExport')
                        : point.present
                          ? t('accounts.listedIn', { path: point.sourcePath ?? '' })
                          : t('accounts.notListed')
                    }
                    className={cx(
                      'rounded-lg border px-3 py-2 text-xs',
                      !point.covered
                        ? 'border-dashed border-ink-700 text-ink-500'
                        : point.present
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                          : 'border-ink-700 bg-ink-900 text-ink-500',
                    )}
                  >
                    <span className="block font-medium">{point.label}</span>
                    <span className="block">
                      {!point.covered ? t('accounts.listNotInExport') : point.present ? t('accounts.present') : t('accounts.absent')}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>{t('accounts.whatSnapshotsShow')}</SectionTitle>
        {timeline.events.length === 0 ? (
          <Callout tone="neutral">{t('accounts.nothingChanged')}</Callout>
        ) : (
          <ul className="space-y-2">
            {timeline.events.map((event, i) => (
              <Card as="li" key={`${event.kind}-${event.at}-${i}`} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink-100">
                    {event.fromLabel} &rarr; {event.toLabel}
                  </span>
                  <EvidenceBadge level={event.evidence} />
                </div>
                <p className="mt-1 text-sm text-ink-400">{event.statement}</p>
              </Card>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
