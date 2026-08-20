import { useMemo } from 'react';
import { buildCurrentState, nonFollowers } from '../analysis/currentState';
import { AccountTable } from '../components/AccountTable';
import { Button, Callout, EmptyState, StatCard } from '../components/ui';
import { formatCount, formatDate } from '../lib/format';
import { useStore } from '../state/store';

export function NonFollowersScreen({
  onOpenAccount,
  onUpload,
}: {
  onOpenAccount: (handle: string) => void;
  onUpload: () => void;
}) {
  const { snapshots, settings, classify, updateSettings } = useStore();
  const snapshot = snapshots.at(-1);
  const state = useMemo(() => buildCurrentState(snapshot), [snapshot]);
  const rows = useMemo(() => nonFollowers(state), [state]);

  if (!snapshot) {
    return (
      <EmptyState
        title="Nothing to compare yet"
        action={
          <Button variant="primary" onClick={onUpload}>
            Upload an export
          </Button>
        }
      >
        Upload an export to see which accounts you follow do not follow you back.
      </EmptyState>
    );
  }

  if (!snapshot.kindsPresent.includes('follower') || !snapshot.kindsPresent.includes('following')) {
    return (
      <Callout tone="warning" title="This needs both lists">
        Your newest snapshot ("{snapshot.label}") is missing{' '}
        {snapshot.kindsPresent.includes('follower') ? 'the following list' : 'the followers list'}.
        Working out who does not follow back requires comparing the two against each other.
      </Callout>
    );
  }

  const classified = rows.filter((r) => {
    const category = settings.classifications[r.handle]?.category;
    return category && category !== 'unknown';
  }).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Do not follow you back"
          value={formatCount(rows.length)}
          hint={`From "${snapshot.label}", ${formatDate(snapshot.exportedAt)}`}
          accent="amber"
        />
        <StatCard
          label="You have classified"
          value={`${formatCount(classified)} of ${formatCount(rows.length)}`}
          hint="Categories are yours alone and never leave this browser"
        />
        <StatCard
          label="Mutuals"
          value={formatCount(state.counts.mutuals)}
          accent="emerald"
          hint="Following each other"
        />
      </div>

      <Callout tone="neutral" title="Why there is no automatic influencer detection">
        Instagram&rsquo;s export lists usernames and follow dates and nothing else &mdash; no
        follower counts, no verification badges, no account types. Any automatic guess at who is a
        creator or a brand would be invented rather than derived, so this app asks you instead. Set
        a category in the last column and the filter below will respect it.
      </Callout>

      <AccountTable
        rows={rows}
        classifications={settings.classifications}
        onOpenAccount={onOpenAccount}
        onClassify={classify}
        hideNonPersonal={settings.hideNonPersonalInNonFollowers}
        onHideNonPersonalChange={(value) =>
          updateSettings({ hideNonPersonalInNonFollowers: value })
        }
        emptyTitle="Everyone you follow follows you back"
        emptyBody="Either that, or the current filters hide the rest."
      />
    </div>
  );
}
