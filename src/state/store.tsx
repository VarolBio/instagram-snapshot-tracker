import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { sortSnapshots } from '../analysis/currentState';
import { renameKey } from '../analysis/rename';
import { detectLocale, getLocale, setLocale, t } from '../i18n';
import {
  DEFAULT_SETTINGS,
  type AccountCategory,
  type AppSettings,
  type ParsedSnapshot,
  type Snapshot,
} from '../model/types';
import * as repo from '../storage/repo';
import type { StoredData } from '../storage/repo';

export type DuplicateKind = 'identical' | 'same-day';

export interface DuplicateWarning {
  kind: DuplicateKind;
  existing: Snapshot;
}

interface StoreValue {
  ready: boolean;
  /** Oldest first. */
  snapshots: Snapshot[];
  settings: AppSettings;
  persistenceError: string | null;
  addSnapshot(parsed: ParsedSnapshot, label: string, exportedAt: string): Promise<Snapshot>;
  removeSnapshot(id: string): Promise<void>;
  renameSnapshot(id: string, label: string): Promise<void>;
  classify(handle: string, category: AccountCategory): Promise<void>;
  classifyMany(handles: readonly string[], category: AccountCategory): Promise<void>;
  dismissKeywordSuggestions(handles: readonly string[]): Promise<void>;
  dismissRename(from: string, to: string): Promise<void>;
  updateSettings(patch: Partial<AppSettings>): Promise<void>;
  wipe(): Promise<void>;
  restore(data: StoredData): Promise<void>;
  checkDuplicate(parsed: ParsedSnapshot): DuplicateWarning | null;
}

const StoreContext = createContext<StoreValue | null>(null);

/**
 * ponytail: the whole database is held in memory and every view is derived from it.
 * A few snapshots of a few thousand accounts is well under a megabyte, so indexes and
 * pagination would be cost without benefit. Past roughly 50k observations this should
 * become an indexed observation store queried per screen.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    repo
      .loadAll()
      .then((data) => {
        if (cancelled) return;
        setSnapshots(sortSnapshots(data.snapshots));
        setSettings(data.settings);
        setLocale(data.settings.locale);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setPersistenceError(
          t('app.persistenceError', {
            detail: error instanceof Error ? error.message : String(error),
          }),
        );
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persistSettings = useCallback(async (next: AppSettings) => {
    setLocale(next.locale);
    setSettings(next);
    await repo.saveSettings(next);
  }, []);

  const value = useMemo<StoreValue>(() => {
    return {
      ready,
      snapshots,
      settings,
      persistenceError,

      async addSnapshot(parsed, label, exportedAt) {
        const snapshot: Snapshot = {
          ...parsed,
          id: crypto.randomUUID(),
          label: label.trim() || defaultLabel(exportedAt),
          exportedAt,
          importedAt: new Date().toISOString(),
        };
        setSnapshots((current) => sortSnapshots([...current, snapshot]));
        await repo.saveSnapshot(snapshot);
        return snapshot;
      },

      async removeSnapshot(id) {
        setSnapshots((current) => current.filter((s) => s.id !== id));
        await repo.deleteSnapshot(id);
      },

      async renameSnapshot(id, label) {
        let updated: Snapshot | undefined;
        setSnapshots((current) =>
          current.map((s) => {
            if (s.id !== id) return s;
            updated = { ...s, label };
            return updated;
          }),
        );
        if (updated) await repo.saveSnapshot(updated);
      },

      async classify(handle, category) {
        await persistSettings({
          ...settings,
          classifications: {
            ...settings.classifications,
            [handle]: { handle, category, updatedAt: new Date().toISOString() },
          },
        });
      },

      async classifyMany(handles, category) {
        if (handles.length === 0) return;
        const now = new Date().toISOString();
        const classifications = { ...settings.classifications };
        for (const handle of handles) {
          classifications[handle] = { handle, category, updatedAt: now };
        }
        await persistSettings({ ...settings, classifications });
      },

      async dismissKeywordSuggestions(handles) {
        if (handles.length === 0) return;
        const extra = handles.filter((h) => !settings.dismissedKeywordSuggestions.includes(h));
        if (extra.length === 0) return;
        await persistSettings({
          ...settings,
          dismissedKeywordSuggestions: [...settings.dismissedKeywordSuggestions, ...extra],
        });
      },

      async dismissRename(from, to) {
        const key = renameKey(from, to);
        if (settings.dismissedRenames.includes(key)) return;
        await persistSettings({
          ...settings,
          dismissedRenames: [...settings.dismissedRenames, key],
        });
      },

      async updateSettings(patch) {
        await persistSettings({ ...settings, ...patch });
      },

      async wipe() {
        const next = { ...DEFAULT_SETTINGS, locale: detectLocale() };
        setSnapshots([]);
        setSettings(next);
        setLocale(next.locale);
        await repo.deleteEverything();
      },

      async restore(data) {
        const locale = data.settings.locale ?? detectLocale();
        const settings = { ...data.settings, locale };
        setSnapshots(sortSnapshots(data.snapshots));
        setSettings(settings);
        setLocale(locale);
        await repo.replaceAll({ ...data, settings });
      },

      checkDuplicate(parsed) {
        const identical = snapshots.find((s) => s.contentHash === parsed.contentHash);
        if (identical) {
          return { kind: 'identical', existing: identical };
        }

        const sameDay = snapshots.find((s) => isSameDay(s.exportedAt, parsed.exportedAt));
        if (sameDay) {
          return { kind: 'same-day', existing: sameDay };
        }

        return null;
      },
    };
  }, [ready, snapshots, settings, persistenceError, persistSettings]);

  return <StoreContext value={value}>{children}</StoreContext>;
}

export function useStore(): StoreValue {
  const value = use(StoreContext);
  if (!value) throw new Error('useStore must be used inside StoreProvider');
  return value;
}

export function defaultLabel(exportedAt: string): string {
  const date = new Date(exportedAt);
  if (Number.isNaN(date.getTime())) return t('upload.untitled');
  const tag = getLocale() === 'tr' ? 'tr-TR' : 'en-GB';
  return date.toLocaleDateString(tag, { year: 'numeric', month: 'long', day: 'numeric' });
}

function isSameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}
