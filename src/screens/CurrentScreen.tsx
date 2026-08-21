import { useMemo, useState } from 'react';
import { buildCurrentState } from '../analysis/currentState';
import { AccountTable } from '../components/AccountTable';
import { Button, Callout, EmptyState, Select, StatCard } from '../components/ui';
import { formatCount, formatDate } from '../lib/format';
import { useStore } from '../state/store';

type Filter = 'all' | 'mutuals' | 'not-following-back' | 'you-do-not-follow-back';

const FILTER_LABELS: Record<Filter, string> = {
  all: 'Everyone in this snapshot',
  mutuals: 'Mutuals only',
  'not-following-back': 'You follow them, they do not follow you',
  'you-do-not-follow-back': 'They follow you, you do not follow them',
};

export function CurrentScreen({
  onOpenAccount,
  onUpload,
}: {
  onOpenAccount: (handle: string) => void;
  onUpload: () => void;
}) {
  const { snapshots, settings, classify } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const snapshot = snapshots.find((s) => s.id === selectedId) ?? snapshots.at(-1);
  const state = useMemo(() => buildCurrentState(snapshot), [snapshot]);

  if (!snapshot) {
    return (
      <EmptyState
        title="Nothing to show yet"
        action={
          <Button variant="primary" onClick={onUpload}>
            Upload an export
          </Button>
        }
      >
        Upload an Instagram export and this becomes a picture of who follows whom.
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
          aria-label="Snapshot"
        >
          {snapshots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} ({formatDate(s.exportedAt)})
            </option>
          ))}
        </Select>
        <p className="text-xs text-ink-500">
          Everything below is stated directly by this one export.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Followers"
          value={formatCount(state.counts.followers)}
          accent="sky"
          onClick={() => setFilter('all')}
        />
        <StatCard
          label="Following"
          value={formatCount(state.counts.following)}
          accent="violet"
          onClick={() => setFilter('all')}
        />
        <StatCard
          label="Mutuals"
          value={formatCount(state.counts.mutuals)}
          accent="emerald"
          onClick={() => setFilter('mutuals')}
        />
        <StatCard
          label="Not following back"
          value={formatCount(state.counts.notFollowingBack)}
          hint="You follow them, they do not follow you"
          accent="amber"
          onClick={() => setFilter('not-following-back')}
        />
      </div>

      {snapshot.warnings
        .filter((w) => w.code === 'possibly_truncated')
        .map((warning, i) => (
          <Callout key={i} tone="warning" title="These counts may be lower than your real totals">
            {warning.message}
          </Callout>
        ))}

      {!snapshot.kindsPresent.includes('follower') ||
      !snapshot.kindsPresent.includes('following') ? (
        <Callout tone="warning" title="This snapshot is incomplete">
          It contains only{' '}
          {snapshot.kindsPresent.includes('follower') ? 'your followers' : 'the accounts you follow'}
          , so mutuals and non-followers cannot be worked out from it.
        </Callout>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          aria-label="Relationship filter"
        >
          {Object.entries(FILTER_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <AccountTable
        rows={rows}
        classifications={settings.classifications}
        onOpenAccount={onOpenAccount}
        onClassify={classify}
        emptyTitle="No accounts match"
        emptyBody="Try a different filter or clear the search box."
      />
    </div>
  );
}
