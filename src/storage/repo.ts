import { DEFAULT_SETTINGS, type AppSettings, type Snapshot } from '../model/types';
import { destroyDb, getDb, isPersistenceAvailable, SETTINGS_KEY } from './db';

export interface StoredData {
  snapshots: Snapshot[];
  settings: AppSettings;
}

export async function loadAll(): Promise<StoredData> {
  if (!isPersistenceAvailable()) return { snapshots: [], settings: DEFAULT_SETTINGS };
  const db = await getDb();
  const [snapshots, settings] = await Promise.all([
    db.getAll('snapshots'),
    db.get('settings', SETTINGS_KEY),
  ]);
  return { snapshots, settings: { ...DEFAULT_SETTINGS, ...settings } };
}

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  if (!isPersistenceAvailable()) return;
  await (await getDb()).put('snapshots', snapshot);
}

export async function deleteSnapshot(id: string): Promise<void> {
  if (!isPersistenceAvailable()) return;
  await (await getDb()).delete('snapshots', id);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (!isPersistenceAvailable()) return;
  await (await getDb()).put('settings', settings, SETTINGS_KEY);
}

export async function deleteEverything(): Promise<void> {
  if (!isPersistenceAvailable()) return;
  await destroyDb();
}

const BACKUP_FORMAT = 'instagram-snapshot-tracker-backup';
const BACKUP_VERSION = 1;

interface Backup {
  format: string;
  version: number;
  createdAt: string;
  snapshots: Snapshot[];
  settings: AppSettings;
}

export function serializeBackup(data: StoredData): string {
  const backup: Backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    snapshots: data.snapshots,
    settings: data.settings,
  };
  return JSON.stringify(backup, null, 2);
}

/**
 * A backup file is user-supplied input, so it is checked before anything is trusted.
 * The goal is a clear message rather than a half-loaded database.
 */
export function parseBackup(json: string): StoredData {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('That file is not valid JSON.');
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new Error('That file does not look like a backup.');
  }

  const backup = raw as Partial<Backup>;
  if (backup.format !== BACKUP_FORMAT) {
    throw new Error('That file was not created by this app.');
  }
  if (!Array.isArray(backup.snapshots)) {
    throw new Error('The backup is missing its snapshots.');
  }

  const snapshots = backup.snapshots.filter(isSnapshotLike);
  if (snapshots.length !== backup.snapshots.length) {
    throw new Error('The backup contains snapshots in an unreadable format.');
  }

  return {
    snapshots,
    settings: { ...DEFAULT_SETTINGS, ...(backup.settings ?? {}) },
  };
}

function isSnapshotLike(value: unknown): value is Snapshot {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Partial<Snapshot>;
  return (
    typeof s.id === 'string' &&
    typeof s.exportedAt === 'string' &&
    Array.isArray(s.observations) &&
    Array.isArray(s.kindsPresent)
  );
}

export async function replaceAll(data: StoredData): Promise<void> {
  if (!isPersistenceAvailable()) return;
  await destroyDb();
  const db = await getDb();
  const tx = db.transaction(['snapshots', 'settings'], 'readwrite');
  for (const snapshot of data.snapshots) {
    await tx.objectStore('snapshots').put(snapshot);
  }
  await tx.objectStore('settings').put(data.settings, SETTINGS_KEY);
  await tx.done;
}
