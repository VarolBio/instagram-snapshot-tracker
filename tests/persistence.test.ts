/**
 * Exercises the real IndexedDB code paths against an in-memory implementation, because
 * a bug here loses a history the user cannot re-create: old Instagram exports are not
 * re-issuable, so a lost snapshot is lost permanently.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { PARSER_VERSION, type AppSettings, type Snapshot } from '../src/model/types';
import {
  deleteEverything,
  deleteSnapshot,
  loadAll,
  replaceAll,
  saveSettings,
  saveSnapshot,
} from '../src/storage/repo';

function snapshot(id: string, exportedAt: string): Snapshot {
  return {
    id,
    label: id,
    exportedAt,
    exportedAtSource: 'document_header',
    importedAt: exportedAt,
    parserVersion: PARSER_VERSION,
    sourceFiles: [
      {
        path: 'connections/followers_and_following/followers_1.html',
        bytes: 100,
        contentHash: 'h',
        kind: 'follower',
        kindSource: 'document_heading',
        extractorId: 'anchor-block',
        entryCount: 1,
      },
    ],
    kindsPresent: ['follower'],
    warnings: [],
    observations: [
      {
        handle: id,
        displayHandle: id,
        kind: 'follower',
        followedAt: Date.parse(exportedAt),
        followedAtRaw: 'Aug 01, 2026 9:09 am',
        sourcePath: 'connections/followers_and_following/followers_1.html',
      },
    ],
    contentHash: `hash-${id}`,
  };
}

beforeEach(async () => {
  await deleteEverything();
});

describe('saving and reloading', () => {
  it('starts empty with default settings', async () => {
    const data = await loadAll();
    expect(data.snapshots).toEqual([]);
    expect(data.settings.dismissedRenames).toEqual([]);
  });

  it('returns a snapshot exactly as it was stored', async () => {
    const original = snapshot('january', '2026-01-01T00:00:00.000Z');
    await saveSnapshot(original);
    const [reloaded] = (await loadAll()).snapshots;
    expect(reloaded).toEqual(original);
  });

  it('keeps several snapshots side by side', async () => {
    await saveSnapshot(snapshot('january', '2026-01-01T00:00:00.000Z'));
    await saveSnapshot(snapshot('april', '2026-04-01T00:00:00.000Z'));
    expect((await loadAll()).snapshots.map((s) => s.id).sort()).toEqual(['april', 'january']);
  });

  it('overwrites rather than duplicating when a snapshot is edited', async () => {
    await saveSnapshot(snapshot('january', '2026-01-01T00:00:00.000Z'));
    await saveSnapshot({ ...snapshot('january', '2026-01-01T00:00:00.000Z'), label: 'Renamed' });
    const { snapshots } = await loadAll();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].label).toBe('Renamed');
  });

  it('deletes one snapshot without touching the others', async () => {
    await saveSnapshot(snapshot('january', '2026-01-01T00:00:00.000Z'));
    await saveSnapshot(snapshot('april', '2026-04-01T00:00:00.000Z'));
    await deleteSnapshot('january');
    expect((await loadAll()).snapshots.map((s) => s.id)).toEqual(['april']);
  });
});

describe('settings', () => {
  const settings: AppSettings = {
    classifications: {
      someone: { handle: 'someone', category: 'creator', updatedAt: '2026-01-01T00:00:00.000Z' },
    },
    dismissedRenames: ['a->b'],
    hideNonPersonalInNonFollowers: true,
    brandKeywords: ['shop'],
    dismissedKeywordSuggestions: ['notabrand'],
  };

  it('survives a reload', async () => {
    await saveSettings(settings);
    expect((await loadAll()).settings).toEqual(settings);
  });

  it('outlives the snapshots it describes', async () => {
    await saveSnapshot(snapshot('january', '2026-01-01T00:00:00.000Z'));
    await saveSettings(settings);
    await deleteSnapshot('january');
    expect((await loadAll()).settings.classifications.someone.category).toBe('creator');
  });
});

describe('restoring a backup', () => {
  it('replaces everything that was there before', async () => {
    await saveSnapshot(snapshot('stale', '2020-01-01T00:00:00.000Z'));
    await replaceAll({
      snapshots: [
        snapshot('january', '2026-01-01T00:00:00.000Z'),
        snapshot('april', '2026-04-01T00:00:00.000Z'),
      ],
      settings: {
        classifications: {},
        dismissedRenames: ['x->y'],
        hideNonPersonalInNonFollowers: false,
        brandKeywords: [],
        dismissedKeywordSuggestions: [],
      },
    });

    const data = await loadAll();
    expect(data.snapshots.map((s) => s.id).sort()).toEqual(['april', 'january']);
    expect(data.settings.dismissedRenames).toEqual(['x->y']);
  });
});

describe('deleting everything', () => {
  it('leaves nothing behind and still works afterwards', async () => {
    await saveSnapshot(snapshot('january', '2026-01-01T00:00:00.000Z'));
    await saveSettings({
      classifications: {},
      dismissedRenames: ['a->b'],
      hideNonPersonalInNonFollowers: true,
      brandKeywords: ['shop'],
      dismissedKeywordSuggestions: [],
    });

    await deleteEverything();

    const data = await loadAll();
    expect(data.snapshots).toEqual([]);
    expect(data.settings.dismissedRenames).toEqual([]);

    await saveSnapshot(snapshot('fresh', '2026-06-01T00:00:00.000Z'));
    expect((await loadAll()).snapshots).toHaveLength(1);
  });
});
