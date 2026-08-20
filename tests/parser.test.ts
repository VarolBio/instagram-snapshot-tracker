import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { parseRawFiles, parseUpload, type RawFile } from '../src/parser';
import { extractHandleFromHref, parseTimestamp } from '../src/parser/normalize';
import { buildExportHtml, handles, type FixtureEntry } from './fixtures/exports';

function raw(path: string, text: string): RawFile {
  return { path, text, bytes: text.length };
}

function handlesOf(snapshot: ReturnType<typeof parseRawFiles>, kind: string): string[] {
  return snapshot.observations
    .filter((o) => o.kind === kind)
    .map((o) => o.handle)
    .sort();
}

describe('handle extraction', () => {
  it('reads a plain profile link', () => {
    expect(extractHandleFromHref('https://www.instagram.com/sample.person')).toBe('sample.person');
  });

  it('strips the /_u/ deep-link prefix used throughout following.html', () => {
    expect(extractHandleFromHref('https://www.instagram.com/_u/sample_person')).toBe(
      'sample_person',
    );
  });

  it('normalizes case, trailing slashes, query strings and encoding', () => {
    expect(extractHandleFromHref('http://instagram.com/MixedCase/?hl=en')).toBe('mixedcase');
    expect(extractHandleFromHref('https://www.instagram.com/_u/Some.One/')).toBe('some.one');
    expect(extractHandleFromHref('https://www.instagram.com/a%2Eb')).toBe('a.b');
  });

  it('rejects non-profile links', () => {
    expect(extractHandleFromHref('https://www.instagram.com/p/Cabc123/')).toBeNull();
    expect(extractHandleFromHref('https://www.instagram.com/explore/tags/x')).toBeNull();
    expect(extractHandleFromHref('https://example.com/someone')).toBeNull();
    expect(extractHandleFromHref('mailto:someone@example.com')).toBeNull();
    expect(extractHandleFromHref('')).toBeNull();
  });
});

describe('timestamp parsing', () => {
  it('parses the format Instagram prints', () => {
    const parsed = parseTimestamp('Aug 01, 2026 9:09 am');
    expect(parsed?.raw).toBe('Aug 01, 2026 9:09 am');
    expect(new Date(parsed!.epoch!).toISOString()).toBe('2026-08-01T09:09:00.000Z');
  });

  it('handles noon and midnight correctly', () => {
    expect(new Date(parseTimestamp('Jan 05, 2020 12:30 am')!.epoch!).toISOString()).toBe(
      '2020-01-05T00:30:00.000Z',
    );
    expect(new Date(parseTimestamp('Jan 05, 2020 12:30 pm')!.epoch!).toISOString()).toBe(
      '2020-01-05T12:30:00.000Z',
    );
  });

  it('returns null for text with no date', () => {
    expect(parseTimestamp('some.username')).toBeNull();
  });
});

describe('parsing followers and following files', () => {
  const followers = buildExportHtml({
    heading: 'Followers',
    linkStyle: 'followers',
    entries: [
      { handle: 'alex', timestamp: 'Aug 01, 2026 9:09 am' },
      { handle: 'bea', timestamp: 'Jul 31, 2026 7:11 am' },
    ],
  });

  const following = buildExportHtml({
    heading: 'Following',
    linkStyle: 'following',
    entries: [
      { handle: 'alex', timestamp: 'Jan 19, 2018 10:42 am' },
      { handle: 'cass', timestamp: 'Aug 15, 2026 9:01 am' },
    ],
  });

  it('reads both lists and keeps them separate', () => {
    const snap = parseRawFiles([
      raw('connections/followers_and_following/followers_1.html', followers),
      raw('connections/followers_and_following/following.html', following),
    ]);

    expect(handlesOf(snap, 'follower')).toEqual(['alex', 'bea']);
    expect(handlesOf(snap, 'following')).toEqual(['alex', 'cass']);
    expect(snap.kindsPresent).toEqual(['follower', 'following']);
    expect(snap.warnings).toEqual([]);
  });

  it('derives handles from the href even when the link text is a full URL', () => {
    const snap = parseRawFiles([raw('following.html', following)]);
    // The regression this guards: reading link text would yield "https://www.instagram.com/_u/alex".
    expect(handlesOf(snap, 'following')).toEqual(['alex', 'cass']);
    expect(snap.observations.every((o) => o.displayHandle === o.handle)).toBe(true);
  });

  it('attaches each follow date to the right account', () => {
    const snap = parseRawFiles([raw('followers_1.html', followers)]);
    const alex = snap.observations.find((o) => o.handle === 'alex')!;
    expect(alex.followedAtRaw).toBe('Aug 01, 2026 9:09 am');
    expect(new Date(alex.followedAt!).toISOString()).toBe('2026-08-01T09:09:00.000Z');
  });

  it('records provenance for every observation', () => {
    const snap = parseRawFiles([
      raw('connections/followers_and_following/followers_1.html', followers),
    ]);
    expect(snap.observations.every((o) => o.sourcePath.endsWith('followers_1.html'))).toBe(true);
    expect(snap.sourceFiles[0].extractorId).toBe('anchor-block');
    expect(snap.sourceFiles[0].entryCount).toBe(2);
  });

  it('merges multi-part followers files', () => {
    const part1 = buildExportHtml({ heading: 'Followers', entries: handles('a', 3) });
    const part2 = buildExportHtml({ heading: 'Followers', entries: handles('b', 4) });
    const snap = parseRawFiles([raw('followers_1.html', part1), raw('followers_2.html', part2)]);
    expect(handlesOf(snap, 'follower')).toHaveLength(7);
  });
});

describe('deciding which list a file is', () => {
  it('uses the document heading, so renamed files still work', () => {
    const html = buildExportHtml({ heading: 'Following', linkStyle: 'following', entries: handles('x', 2) });
    const snap = parseRawFiles([raw('followingx1x1.html', html)]);
    expect(snap.sourceFiles[0].kind).toBe('following');
    expect(snap.sourceFiles[0].kindSource).toBe('document_heading');
  });

  it('falls back to the filename when the heading is missing', () => {
    const html = buildExportHtml({ omitHeading: true, entries: handles('x', 2) });
    const snap = parseRawFiles([raw('connections/followers_and_following/followers_1.html', html)]);
    expect(snap.sourceFiles[0].kind).toBe('follower');
    expect(snap.sourceFiles[0].kindSource).toBe('filename');
  });

  it('does not let the followers_and_following directory decide the kind', () => {
    const html = buildExportHtml({ omitHeading: true, linkStyle: 'following', entries: handles('x', 2) });
    const snap = parseRawFiles([raw('connections/followers_and_following/following.html', html)]);
    expect(snap.sourceFiles[0].kind).toBe('following');
  });

  it('prefers the heading over a conflicting filename and says so', () => {
    const html = buildExportHtml({ heading: 'Following', entries: handles('x', 2) });
    const snap = parseRawFiles([raw('followers_1.html', html)]);
    expect(snap.sourceFiles[0].kind).toBe('following');
    expect(snap.warnings.map((w) => w.code)).toContain('kind_conflict');
  });

  it('flags a file it cannot place instead of silently dropping it', () => {
    const html = buildExportHtml({ heading: 'Your Topics', entries: handles('x', 2) });
    const snap = parseRawFiles([raw('topics.html', html)]);
    expect(snap.sourceFiles[0].kind).toBe('unmatched');
    expect(snap.observations).toHaveLength(0);
    expect(snap.warnings.map((w) => w.code)).toContain('unmatched_file');
  });
});

describe('resilience', () => {
  it('never attributes a neighbour\u2019s follow date to an undated entry', () => {
    const html = buildExportHtml({
      entries: [
        { handle: 'dated', timestamp: 'Aug 01, 2026 9:09 am' },
        { handle: 'undated' },
      ],
    });
    const snap = parseRawFiles([raw('followers_1.html', html)]);
    const undated = snap.observations.find((o) => o.handle === 'undated')!;
    expect(undated.followedAt).toBeUndefined();
    expect(undated.followedAtRaw).toBeUndefined();
  });

  it('does not mistake the export header date for a follow date', () => {
    const html = buildExportHtml({
      generatedAt: '2026-08-19T16:02Z',
      entries: [{ handle: 'lonely' }],
    });
    const snap = parseRawFiles([raw('followers_1.html', html)]);
    expect(snap.observations[0].followedAt).toBeUndefined();
    expect(snap.exportedAt).toBe('2026-08-19T16:02:00.000Z');
  });

  it('ignores non-profile links mixed into the list', () => {
    const html = buildExportHtml({
      entries: [
        { handle: 'real', timestamp: 'Aug 01, 2026 9:09 am' },
        { handle: 'ignored', href: 'https://www.instagram.com/p/Cabc123/' },
      ],
    });
    const snap = parseRawFiles([raw('followers_1.html', html)]);
    expect(handlesOf(snap, 'follower')).toEqual(['real']);
  });

  it('survives malformed markup', () => {
    const broken =
      '<html><body><h1>Followers</h1><main><div><div>' +
      '<a href="https://www.instagram.com/torn">torn<div>Aug 01, 2026 9:09 am</div>' +
      '</main></body>';
    const snap = parseRawFiles([raw('followers_1.html', broken)]);
    expect(handlesOf(snap, 'follower')).toEqual(['torn']);
  });

  it('warns rather than throwing on an empty list', () => {
    const html = buildExportHtml({ heading: 'Followers', entries: [] });
    const snap = parseRawFiles([raw('followers_1.html', html)]);
    expect(snap.observations).toHaveLength(0);
    expect(snap.warnings.map((w) => w.code)).toContain('no_entries');
    expect(snap.kindsPresent).toEqual(['follower']);
  });

  it('merges duplicate handles within a file and reports the count', () => {
    const html = buildExportHtml({
      entries: [
        { handle: 'twice', timestamp: 'Aug 01, 2026 9:09 am' },
        { handle: 'TWICE', timestamp: 'Aug 02, 2026 9:09 am' },
      ],
    });
    const snap = parseRawFiles([raw('followers_1.html', html)]);
    expect(handlesOf(snap, 'follower')).toEqual(['twice']);
    expect(snap.warnings.map((w) => w.code)).toContain('duplicate_handles');
  });

  it('falls back to reading plain @handle text and flags the lower confidence', () => {
    const html =
      '<html><body><h1>Followers</h1><main><ul>' +
      '<li>@one.person</li><li>@two_person</li></ul></main></body></html>';
    const snap = parseRawFiles([raw('followers_1.html', html)]);
    expect(handlesOf(snap, 'follower')).toEqual(['one.person', 'two_person']);
    expect(snap.sourceFiles[0].extractorId).toBe('text-list');
    expect(snap.warnings.map((w) => w.code)).toContain('no_timestamps');
  });
});

describe('export dating', () => {
  it('reads the date, account and coverage window out of the document header', () => {
    const html = buildExportHtml({
      generatedBy: 'sampleaccount',
      generatedAt: '2026-08-19T16:02Z',
      coverage: { from: '2025-07-23T21:00Z', to: '2026-08-08T21:00Z' },
      entries: handles('x', 2),
    });
    const snap = parseRawFiles([raw('followers_1.html', html)]);
    expect(snap.exportedAtSource).toBe('document_header');
    expect(snap.exportedAt).toBe('2026-08-19T16:02:00.000Z');
    expect(snap.generatedBy).toBe('sampleaccount');
    expect(snap.coverage).toEqual({
      from: '2025-07-23T21:00:00.000Z',
      to: '2026-08-08T21:00:00.000Z',
    });
  });

  it('falls back to the archive filename', () => {
    const html = buildExportHtml({ omitAside: true, entries: [{ handle: 'x' }] });
    const snap = parseRawFiles([raw('followers_1.html', html)], ['instagram-me-2026-03-04-A1b2.zip']);
    expect(snap.exportedAtSource).toBe('zip_filename');
    expect(snap.exportedAt).toBe('2026-03-04T00:00:00.000Z');
  });

  it('falls back to the newest follow date it saw', () => {
    const html = buildExportHtml({
      omitAside: true,
      entries: [
        { handle: 'a', timestamp: 'Jan 01, 2020 1:00 am' },
        { handle: 'b', timestamp: 'Jun 09, 2024 5:00 pm' },
      ],
    });
    const snap = parseRawFiles([raw('followers_1.html', html)]);
    expect(snap.exportedAtSource).toBe('latest_observation');
    expect(snap.exportedAt).toBe('2024-06-09T17:00:00.000Z');
  });

  it('warns when two files come from different exports', () => {
    const a = buildExportHtml({ heading: 'Followers', generatedAt: '2026-01-01T00:00Z', entries: handles('a', 1) });
    const b = buildExportHtml({ heading: 'Following', generatedAt: '2026-06-01T00:00Z', entries: handles('b', 1) });
    const snap = parseRawFiles([raw('followers_1.html', a), raw('following.html', b)]);
    expect(snap.warnings.map((w) => w.code)).toContain('mixed_export_dates');
    expect(snap.exportedAt).toBe('2026-06-01T00:00:00.000Z');
  });
});

describe('content hashing for duplicate detection', () => {
  const entries: FixtureEntry[] = handles('x', 5);

  it('matches when the same accounts are present', () => {
    const a = parseRawFiles([raw('followers_1.html', buildExportHtml({ entries }))]);
    const b = parseRawFiles([
      raw('followers_1.html', buildExportHtml({ entries, generatedAt: '2027-01-01T00:00Z' })),
    ]);
    expect(a.contentHash).toBe(b.contentHash);
  });

  it('differs when the accounts differ', () => {
    const a = parseRawFiles([raw('followers_1.html', buildExportHtml({ entries }))]);
    const b = parseRawFiles([
      raw('followers_1.html', buildExportHtml({ entries: [...entries, { handle: 'extra' }] })),
    ]);
    expect(a.contentHash).not.toBe(b.contentHash);
  });

  it('differs when the same accounts appear under a different list', () => {
    const a = parseRawFiles([raw('followers_1.html', buildExportHtml({ heading: 'Followers', entries }))]);
    const b = parseRawFiles([raw('following.html', buildExportHtml({ heading: 'Following', entries }))]);
    expect(a.contentHash).not.toBe(b.contentHash);
  });
});

describe('ZIP uploads', () => {
  it('finds the follower files inside a real-shaped archive', async () => {
    const zipped = zipSync({
      'connections/followers_and_following/followers_1.html': strToU8(
        buildExportHtml({ heading: 'Followers', entries: handles('f', 3) }),
      ),
      'connections/followers_and_following/following.html': strToU8(
        buildExportHtml({ heading: 'Following', linkStyle: 'following', entries: handles('g', 4) }),
      ),
      'personal_information/personal_information.html': strToU8('<html><body>unrelated</body></html>'),
      '__MACOSX/._followers_1.html': strToU8('junk'),
      'media/photo.jpg': strToU8('not html'),
    });

    const file = new File([zipped as BlobPart], 'instagram-me-2026-08-19-A1b2.zip', {
      type: 'application/zip',
    });
    const snap = await parseUpload([file]);

    expect(handlesOf(snap, 'follower')).toHaveLength(3);
    expect(handlesOf(snap, 'following')).toHaveLength(4);
    expect(snap.sourceFiles.some((f) => f.path.includes('personal_information'))).toBe(true);
    expect(snap.sourceFiles.some((f) => f.path.includes('__MACOSX'))).toBe(false);
  });

  it('accepts loose HTML files dropped straight in', async () => {
    const html = buildExportHtml({ heading: 'Followers', entries: handles('f', 2) });
    const file = new File([html], 'followers_1x1x1.html', { type: 'text/html' });
    const snap = await parseUpload([file]);
    expect(handlesOf(snap, 'follower')).toHaveLength(2);
  });

  it('explains itself when the archive holds no HTML', async () => {
    const zipped = zipSync({ 'connections/followers_and_following/followers_1.json': strToU8('[]') });
    const file = new File([zipped as BlobPart], 'export.zip', { type: 'application/zip' });
    const snap = await parseUpload([file]);
    expect(snap.warnings[0].message).toContain('JSON');
  });
});
