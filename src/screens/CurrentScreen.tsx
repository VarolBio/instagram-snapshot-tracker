import { useMemo, useState } from 'react';
import { buildCurrentState } from '../analysis/currentState';
import { AccountTable } from '../components/AccountTable';
import { Button, Callout, EmptyState, Select, StatCard } from '../components/ui';
import { formatParseWarning, t, useI18n } from '../i18n';
import { formatCount, formatDate } from '../lib/format';
import { useStore } from '../state/store';

type Filter = 'all' | 'mutuals' | 'not-following-back' | 'you-do-not-follow-back';

export function CurrentScreen({
  onOpenAccount,
  onUpload,
}: {
  onOpenAccount: (handle: string) => void;
  onUpload: () => void;
}) {
  const { locale } = useI18n();
  const { snapshots, settings, classify } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const snapshot = snapshots.find((s) => s.id === selectedId) ?? snapshots.at(-1);
  const state = useMemo(() => buildCurrentState(snapshot), [snapshot]);
  void locale;

  if (!snapshot) {
    return (
      <EmptyState
        title={t('current.emptyTitle')}
        action={
          <Button variant="primary" onClick={onUpload}>
            {t('current.upload')}
          </Button>
        }
      >
        {t('current.emptyBody')}
      </EmptyState>
    );
  }

  const rows = state.rows.filter((row) => {
    if (filter === 'mutuals') return row.isFollower && row.isFollowing;
    if (filter === 'not-following-back') return row.isFollowing && !row.isFollower;
    if (filter === 'you-do-not-follow-back') return row.isFollower && !row.isFollowing;
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={snapshot.id}
          onChange={(e) => setSelectedId(e.target.value)}
          aria-label={t('current.snapshot')}
        >
          {snapshots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} ({formatDate(s.exportedAt)})
            </option>
          ))}
        </Select>
        <p className="text-xs text-ink-500">{t('current.statedByExport')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t('current.followers')}
          value={formatCount(state.counts.followers)}
          accent="sky"
          onClick={() => setFilter('all')}
        />
        <StatCard
          label={t('current.following')}
          value={formatCount(state.counts.following)}
          accent="violet"
          onClick={() => setFilter('all')}
        />
        <StatCard
          label={t('current.mutuals')}
          value={formatCount(state.counts.mutuals)}
          accent="emerald"
          onClick={() => setFilter('mutuals')}
        />
        <StatCard
          label={t('current.notFollowingBack')}
          value={formatCount(state.counts.notFollowingBack)}
          hint={t('current.notFollowingBackHint')}
          accent="amber"
          onClick={() => setFilter('not-following-back')}
        />
      </div>

      {snapshot.warnings
        .filter((w) => w.code === 'possibly_truncated')
        .map((warning, i) => (
          <Callout key={i} tone="warning" title={t('current.truncatedTitle')}>
            {formatParseWarning(warning)}
          </Callout>
        ))}

      {!snapshot.kindsPresent.includes('follower') ||
      !snapshot.kindsPresent.includes('following') ? (
        <Callout tone="warning" title={t('current.incompleteTitle')}>
          {snapshot.kindsPresent.includes('follower')
            ? t('current.incompleteFollowers')
            : t('current.incompleteFollowing')}
        </Callout>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          aria-label={t('current.filter')}
        >
          <option value="all">{t('current.filterAll')}</option>
          <option value="mutuals">{t('current.filterMutuals')}</option>
          <option value="not-following-back">{t('current.filterNotBack')}</option>
          <option value="you-do-not-follow-back">{t('current.filterYouDont')}</option>
        </Select>
      </div>

      <AccountTable
        rows={rows}
        classifications={settings.classifications}
        onOpenAccount={onOpenAccount}
        onClassify={classify}
        emptyTitle={t('current.noMatchTitle')}
        emptyBody={t('current.noMatchBody')}
      />
    </div>
  );
}
