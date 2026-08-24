import { useState } from 'react';
import { PrivacyBanner } from './components/PrivacyBanner';
import { Callout, cx } from './components/ui';
import { t, useI18n, type Locale } from './i18n';
import { AccountScreen } from './screens/AccountScreen';
import { ChangesScreen } from './screens/ChangesScreen';
import { CurrentScreen } from './screens/CurrentScreen';
import { NonFollowersScreen } from './screens/NonFollowersScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SnapshotsScreen } from './screens/SnapshotsScreen';
import { UploadScreen } from './screens/UploadScreen';
import { StoreProvider, useStore } from './state/store';

const TAB_IDS = [
  'upload',
  'current',
  'non-followers',
  'changes',
  'accounts',
  'snapshots',
  'settings',
] as const;

type TabId = (typeof TAB_IDS)[number];

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { ready, snapshots, persistenceError, settings, updateSettings } = useStore();
  const { locale } = useI18n();
  const [tab, setTab] = useState<TabId>('upload');
  const [account, setAccount] = useState<string | null>(null);

  function openAccount(handle: string) {
    setAccount(handle);
    setTab('accounts');
  }

  function goToUpload() {
    setTab('upload');
  }

  function switchLocale(next: Locale) {
    if (next === settings.locale) return;
    void updateSettings({ locale: next });
  }

  return (
    <div className="min-h-dvh">
      <PrivacyBanner />

      <header className="border-b border-ink-800">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-4 px-4 py-5">
          <div>
            <h1 className="text-lg font-semibold text-ink-50">{t('app.title')}</h1>
            <p className="mt-1 text-sm text-ink-400">{t('app.tagline')}</p>
          </div>
          <div
            className="flex shrink-0 items-center rounded-lg border border-ink-700 p-0.5"
            role="group"
            aria-label={t('app.language')}
          >
            {(['en', 'tr'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => switchLocale(code)}
                className={cx(
                  'rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide',
                  locale === code ? 'bg-ink-700 text-ink-50' : 'text-ink-400 hover:text-ink-200',
                )}
              >
                {code === 'en' ? t('app.langEn') : t('app.langTr')}
              </button>
            ))}
          </div>
        </div>

        <nav className="mx-auto max-w-6xl px-2">
          <ul className="flex gap-1 overflow-x-auto">
            {TAB_IDS.map((id) => (
              <li key={id}>
                <button
                  onClick={() => {
                    setTab(id);
                    if (id !== 'accounts') setAccount(null);
                  }}
                  className={cx(
                    'rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                    tab === id
                      ? 'border-violet-400 text-ink-50'
                      : 'border-transparent text-ink-400 hover:text-ink-200',
                  )}
                >
                  {t(`tab.${id}`)}
                  {id === 'snapshots' && snapshots.length > 0 ? (
                    <span className="ml-1.5 text-xs text-ink-500">{snapshots.length}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        {persistenceError ? (
          <Callout tone="warning" title={t('app.savingUnavailable')}>
            {persistenceError}
          </Callout>
        ) : null}

        {!ready ? (
          <p className="py-16 text-center text-sm text-ink-500">{t('app.loading')}</p>
        ) : tab === 'upload' ? (
          <UploadScreen onSaved={() => setTab('current')} />
        ) : tab === 'current' ? (
          <CurrentScreen onOpenAccount={openAccount} onUpload={goToUpload} />
        ) : tab === 'non-followers' ? (
          <NonFollowersScreen onOpenAccount={openAccount} onUpload={goToUpload} />
        ) : tab === 'changes' ? (
          <ChangesScreen onOpenAccount={openAccount} onUpload={goToUpload} />
        ) : tab === 'accounts' ? (
          <AccountScreen handle={account} onOpenAccount={setAccount} onUpload={goToUpload} />
        ) : tab === 'snapshots' ? (
          <SnapshotsScreen onUpload={goToUpload} />
        ) : (
          <SettingsScreen />
        )}
      </main>

      <footer className="border-t border-ink-800">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-ink-500">{t('app.footer')}</p>
      </footer>
    </div>
  );
}
