import { useState } from 'react';
import { PrivacyBanner } from './components/PrivacyBanner';
import { Callout, cx } from './components/ui';
import { AccountScreen } from './screens/AccountScreen';
import { ChangesScreen } from './screens/ChangesScreen';
import { CurrentScreen } from './screens/CurrentScreen';
import { NonFollowersScreen } from './screens/NonFollowersScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SnapshotsScreen } from './screens/SnapshotsScreen';
import { UploadScreen } from './screens/UploadScreen';
import { StoreProvider, useStore } from './state/store';

const TABS = [
  { id: 'upload', label: 'Upload' },
  { id: 'current', label: 'Current' },
  { id: 'non-followers', label: "Doesn't follow back" },
  { id: 'changes', label: 'Changes' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'snapshots', label: 'Snapshots' },
  { id: 'settings', label: 'Settings' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { ready, snapshots, persistenceError } = useStore();
  const [tab, setTab] = useState<TabId>('upload');
  const [account, setAccount] = useState<string | null>(null);

  function openAccount(handle: string) {
    setAccount(handle);
    setTab('accounts');
  }

  function goToUpload() {
    setTab('upload');
  }

  return (
    <div className="min-h-dvh">
      <PrivacyBanner />

      <header className="border-b border-ink-800">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <h1 className="text-lg font-semibold text-ink-50">Instagram Snapshot Tracker</h1>
          <p className="mt-1 text-sm text-ink-400">
            Compare your own Instagram data exports over time. Shows what the exports prove, infers
            only what they support, and says so when it cannot tell.
          </p>
        </div>

        <nav className="mx-auto max-w-6xl px-2">
          <ul className="flex gap-1 overflow-x-auto">
            {TABS.map((entry) => (
              <li key={entry.id}>
                <button
                  onClick={() => {
                    setTab(entry.id);
                    if (entry.id !== 'accounts') setAccount(null);
                  }}
                  className={cx(
                    'rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                    tab === entry.id
                      ? 'border-violet-400 text-ink-50'
                      : 'border-transparent text-ink-400 hover:text-ink-200',
                  )}
                >
                  {entry.label}
                  {entry.id === 'snapshots' && snapshots.length > 0 ? (
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
          <Callout tone="warning" title="Saving is unavailable">
            {persistenceError}
          </Callout>
        ) : null}

        {!ready ? (
          <p className="py-16 text-center text-sm text-ink-500">Loading your saved snapshots…</p>
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
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-ink-500">
          No Instagram login, no scraping, no server. This app only reads the export files you give
          it. Instagram is a trademark of Meta Platforms, Inc., which does not endorse this project.
        </p>
      </footer>
    </div>
  );
}
