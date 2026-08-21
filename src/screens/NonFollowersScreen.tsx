import { useMemo } from 'react';
import { suggestForAll } from '../analysis/classify';
import { buildCurrentState, nonFollowers } from '../analysis/currentState';
import { AccountTable } from '../components/AccountTable';
import { Button, Callout, Card, EmptyState, StatCard } from '../components/ui';
import { formatCount, formatDate } from '../lib/format';
import { useStore } from '../state/store';

export function NonFollowersScreen({
  onOpenAccount,
  onUpload,
}: {
  onOpenAccount: (handle: string) => void;
  onUpload: () => void;
}) {
  const { snapshots, settings, classify, classifyMany, dismissKeywordSuggestions, updateSettings } =
    useStore();
  const snapshot = snapshots.at(-1);
  const state = useMemo(() => buildCurrentState(snapshot), [snapshot]);
  const rows = useMemo(() => nonFollowers(state), [state]);

  const dismissed = useMemo(
    () => new Set(settings.dismissedKeywordSuggestions),
    [settings.dismissedKeywordSuggestions],
  );

  const guessed = useMemo(
    () =>
      suggestForAll(
        rows.map((r) => r.handle),
        {
          keywords: settings.brandKeywords,
          alreadyClassified: (handle) => {
            const category = settings.classifications[handle]?.category;
            return Boolean(category && category !== 'unknown');
          },
          dismissed,
        },
      ),
    [rows, settings.brandKeywords, settings.classifications, dismissed],
  );

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
          label="Keyword guesses"
          value={formatCount(guessed.suggestions.length)}
          hint="Usernames that look like organisations. Confirm before they count."
        />
      </div>

      <Callout tone="neutral" title="These guesses only read the username">
        Instagram&rsquo;s export has no follower counts, verification badges, or account types.
        Matching words like <code className="text-ink-200">official</code> or{' '}
        <code className="text-ink-200">.io</code> is a hint, not evidence. Confirm a guess and this
        app treats it as a brand; leave it and nothing is assumed. Edit the word list in Settings.
      </Callout>

      {guessed.suggestions.length > 0 ? (
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink-100">
                {formatCount(guessed.suggestions.length)} username
                {guessed.suggestions.length === 1 ? '' : 's'} look like organisations
              </h3>
              <p className="mt-1 text-xs text-ink-500">
                Suggested as Business / brand. Nothing is saved until you confirm.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() =>
                  classifyMany(
                    guessed.suggestions.map((s) => s.handle),
                    'business',
                  )
                }
              >
                Mark all as brands
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  dismissKeywordSuggestions(guessed.suggestions.map((s) => s.handle))
                }
              >
                Dismiss all
              </Button>
            </div>
          </div>
          <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {guessed.suggestions.map((suggestion) => (
              <li
                key={suggestion.handle}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-800 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <button
                    onClick={() => onOpenAccount(suggestion.handle)}
                    className="font-medium text-ink-100 hover:text-violet-300 hover:underline"
                  >
                    @{suggestion.handle}
                  </button>
                  <p className="text-xs text-ink-500">{suggestion.reason}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="subtle"
                    onClick={() => classify(suggestion.handle, 'business')}
                  >
                    Brand
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismissKeywordSuggestions([suggestion.handle])}
                  >
                    Not a brand
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : settings.brandKeywords.length === 0 ? (
        <Callout tone="neutral">
          Organisation guesses are off because the keyword list is empty. Add words in Settings to
          turn them back on.
        </Callout>
      ) : null}

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
