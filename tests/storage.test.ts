import { describe, expect, it } from 'vitest';
import { parseBackup, serializeBackup } from '../src/storage/repo';
import { DEFAULT_SETTINGS, PARSER_VERSION, type Snapshot } from '../src/model/types';

const snapshot: Snapshot = {
  id: 'abc',
  label: 'January',
  exportedAt: '2026-01-01T00:00:00.000Z',
  exportedAtSource: 'document_header',
  importedAt: '2026-01-02T00:00:00.000Z',
  parserVersion: PARSER_VERSION,
  sourceFiles: [],
  kindsPresent: ['follower'],
  warnings: [],
  observations: [
    {
      handle: 'alex',
      displayHandle: 'alex',
      kind: 'follower',
      sourcePath: 'followers_1.html',
    },
  ],
  contentHash: 'hash',
};

describe('backup round trip', () => {
  it('restores what it saved', () => {
    const json = serializeBackup({ snapshots: [snapshot], settings: DEFAULT_SETTINGS });
    const restored = parseBackup(json);
    expect(restored.snapshots).toEqual([snapshot]);
    expect(restored.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('fills in settings added since the backup was written', () => {
    const json = JSON.stringify({
      format: 'instagram-snapshot-tracker-backup',
      version: 1,
      snapshots: [snapshot],
      settings: { classifications: {} },
    });
    expect(parseBackup(json).settings.dismissedRenames).toEqual([]);
    expect(parseBackup(json).settings.brandKeywords.length).toBeGreaterThan(0);
  });
});

describe('rejecting bad backup files', () => {
  it('explains invalid JSON', () => {
    expect(() => parseBackup('{not json')).toThrow('not valid JSON');
  });

  it('rejects a file from somewhere else', () => {
    expect(() => parseBackup(JSON.stringify({ hello: 'world' }))).toThrow('not created by this app');
  });

  it('rejects a backup with no snapshot array', () => {
    expect(() =>
      parseBackup(JSON.stringify({ format: 'instagram-snapshot-tracker-backup', version: 1 })),
    ).toThrow('missing its snapshots');
  });

  it('rejects snapshots that are the wrong shape rather than half-loading them', () => {
    expect(() =>
      parseBackup(
        JSON.stringify({
          format: 'instagram-snapshot-tracker-backup',
          version: 1,
          snapshots: [{ id: 'x' }],
        }),
      ),
    ).toThrow('unreadable format');
  });
});
