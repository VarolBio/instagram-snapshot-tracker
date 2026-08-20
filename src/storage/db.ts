import { openDB, deleteDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AppSettings, Snapshot } from '../model/types';

export const DB_NAME = 'instagram-snapshot-tracker';
const DB_VERSION = 1;
export const SETTINGS_KEY = 'app';

interface TrackerDB extends DBSchema {
  snapshots: { key: string; value: Snapshot };
  settings: { key: string; value: AppSettings };
}

let connection: Promise<IDBPDatabase<TrackerDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<TrackerDB>> {
  connection ??= openDB<TrackerDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    },
  });
  return connection;
}

/** Drops the entire database. Used by "delete all data". */
export async function destroyDb(): Promise<void> {
  if (connection) {
    (await connection).close();
    connection = null;
  }
  await deleteDB(DB_NAME);
}

export function isPersistenceAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}
