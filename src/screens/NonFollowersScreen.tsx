import { useMemo } from 'react';
import { suggestForAll } from '../analysis/classify';
import { buildCurrentState, nonFollowers } from '../analysis/currentState';
import { AccountTable } from '../components/AccountTable';
import { Button, Callout, Card, EmptyState, StatCard } from '../components/ui';
import { t, useI18n } from '../i18n';
import { formatCount, formatDate } from '../lib/format';
import { useStore } from '../state/store';

export function NonFollowersScreen({
  onOpenAccount,
  onUpload,
}: {
  onOpenAccount: (handle: string) => void;
  onUpload: () => void;
}) {
  const { locale } = useI18n();
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
    [rows, settings.brandKeywords, settings.classifications, dismissed, locale],
  );

  if (!snapshot) {
    return (
      <EmptyState
        title={t('nonFollowers.emptyTitle')}
        action={
          <Button variant="primary" onClick={onUpload}>
            {t('current.upload')}
          </Button>
        }
      >
        {t('nonFollowers.emptyBody')}
      </EmptyState>
    );
  }

  if (!snapshot.kindsPresent.includes('follower') || !snapshot.kindsPresent.includes('following')) {
    return (
      <Callout tone="warning" title={t('nonFollowers.needsBoth')}>
        {t('nonFollowers.needsBothBody', {
          label: snapshot.label,
          missing: snapshot.kindsPresent.includes('follower')
            ? t('nonFollowers.missingFollowing')
            : t('nonFollowers.missingFollowers'),
        })}
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
          label={t('nonFollowers.statLabel')}
          value={formatCount(rows.length)}
          hint={t('nonFollowers.fromSnapshot', {
            label: snapshot.label,
            date: formatDate(snapshot.exportedAt),
          })}
          accent="amber"
        />
        <StatCard
          label={t('nonFollowers.classified')}
          value={`${formatCount(classified)} / ${formatCount(rows.length)}`}
          hint={t('nonFollowers.classifiedHint')}
        />
        <StatCard
          label={t('nonFollowers.guesses')}
          value={formatCount(guessed.suggestions.length)}
          hint={t('nonFollowers.guessesHint')}
        />
      </div>

      <Callout tone="neutral" title={t('nonFollowers.guessesTitle')}>
        {t('nonFollowers.guessesBody')}
      </Callout>

      {guessed.suggestions.length > 0 ? (
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink-100">
                {guessed.suggestions.length === 1
                  ? t('nonFollowers.lookLike', { count: formatCount(guessed.suggestions.length) })
                  : t('nonFollowers.lookLikePlural', {
                      count: formatCount(guessed.suggestions.length),
                    })}
              </h3>
              <p className="mt-1 text-xs text-ink-500">{t('nonFollowers.suggestedAs')}</p>
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
                {t('nonFollowers.markAll')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  dismissKeywordSuggestions(guessed.suggestions.map((s) => s.handle))
                }
              >
                {t('nonFollowers.dismissAll')}
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
                    {t('nonFollowers.brand')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismissKeywordSuggestions([suggestion.handle])}
                  >
                    {t('nonFollowers.notBrand')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : settings.brandKeywords.length === 0 ? (
        <Callout tone="neutral">{t('nonFollowers.guessesOff')}</Callout>
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
        emptyTitle={t('nonFollowers.emptyTableTitle')}
        emptyBody={t('nonFollowers.emptyTableBody')}
      />
    </div>
  );
}
