import {
  PARSER_VERSION,
  RELATION_KINDS,
  RELATION_LABELS,
  type Observation,
  type ParseWarning,
  type ParsedSnapshot,
  type RelationKind,
  type SourceFile,
  type ExportDateSource,
  type KindSource,
} from '../model/types';
import { dateFromArchiveName, readDocumentHeader, type DocumentHeader } from './exportDate';
import { runExtractors } from './extractors';
import { kindFromDocument, kindFromFilename } from './fileRouter';
import { hashString } from './hash';
import { collectFiles, type RawFile } from './zip';

export type { RawFile } from './zip';
export { collectFiles } from './zip';

/** Parses whatever the user dropped into a snapshot that has not been saved yet. */
export async function parseUpload(inputs: File[]): Promise<ParsedSnapshot> {
  const collected = await collectFiles(inputs);
  const parsed = parseRawFiles(collected.files, collected.archiveNames);
  return { ...parsed, warnings: [...collected.warnings, ...parsed.warnings] };
}

export function parseRawFiles(files: RawFile[], archiveNames: string[] = []): ParsedSnapshot {
  const domParser = new DOMParser();
  const warnings: ParseWarning[] = [];
  const sourceFiles: SourceFile[] = [];
  const headers: DocumentHeader[] = [];

  // Keyed "kind\u0000handle" so the same account can legitimately appear in several lists.
  const observations = new Map<string, Observation>();
  const duplicateCounts = new Map<RelationKind, number>();

  for (const file of files) {
    const doc = domParser.parseFromString(file.text, 'text/html');
    headers.push(readDocumentHeader(doc));

    const fromDocument = kindFromDocument(doc);
    const fromFilename = kindFromFilename(file.path);
    const kind = fromDocument ?? fromFilename;
    const kindSource: KindSource = fromDocument
      ? 'document_heading'
      : fromFilename
        ? 'filename'
        : 'none';

    if (fromDocument && fromFilename && fromDocument !== fromFilename) {
      warnings.push({
        code: 'kind_conflict',
        path: file.path,
        message: `${file.path} is named like ${RELATION_LABELS[fromFilename]} but its heading says ${RELATION_LABELS[fromDocument]}. Using the heading.`,
      });
    }

    if (!kind) {
      sourceFiles.push({
        path: file.path,
        bytes: file.bytes,
        contentHash: hashString(file.text),
        kind: 'unmatched',
        kindSource,
        extractorId: null,
        entryCount: 0,
      });
      warnings.push({
        code: 'unmatched_file',
        path: file.path,
        message: `${file.path} was not recognised as a followers or following list, so it was ignored.`,
      });
      continue;
    }

    const { extractorId, confidence, entries } = runExtractors(doc);

    let added = 0;
    let withTimestamp = 0;
    for (const entry of entries) {
      const key = `${kind}\u0000${entry.handle}`;
      if (observations.has(key)) {
        duplicateCounts.set(kind, (duplicateCounts.get(kind) ?? 0) + 1);
        continue;
      }
      observations.set(key, {
        handle: entry.handle,
        displayHandle: entry.displayHandle,
        kind,
        followedAt: entry.followedAt,
        followedAtRaw: entry.followedAtRaw,
        profileUrl: entry.profileUrl,
        sourcePath: file.path,
      });
      added++;
      if (entry.followedAtRaw) withTimestamp++;
    }

    sourceFiles.push({
      path: file.path,
      bytes: file.bytes,
      contentHash: hashString(file.text),
      kind,
      kindSource,
      extractorId,
      entryCount: added,
    });

    if (entries.length === 0) {
      warnings.push({
        code: 'no_entries',
        path: file.path,
        message: `No accounts could be read from ${file.path}. Its format may have changed.`,
      });
    } else if (confidence === 'low') {
      warnings.push({
        code: 'no_timestamps',
        path: file.path,
        message: `${file.path} was read with a fallback strategy because its usual structure was missing. Usernames were recovered but follow dates were not.`,
      });
    } else if (added > 0 && withTimestamp === 0) {
      warnings.push({
        code: 'no_timestamps',
        path: file.path,
        message: `${file.path} contains no follow dates, so rename suggestions are unavailable for ${RELATION_LABELS[kind]}.`,
      });
    }
  }

  for (const [kind, count] of duplicateCounts) {
    warnings.push({
      code: 'duplicate_handles',
      message: `${count} duplicate ${count === 1 ? 'entry' : 'entries'} in ${RELATION_LABELS[kind]} were merged.`,
    });
  }

  const all = [...observations.values()];
  const kindsPresent = RELATION_KINDS.filter((kind) =>
    sourceFiles.some((file) => file.kind === kind),
  );

  const dating = resolveExportDate(headers, archiveNames, all, files, warnings);

  return {
    exportedAt: dating.exportedAt,
    exportedAtSource: dating.source,
    parserVersion: PARSER_VERSION,
    generatedBy: headers.find((h) => h.generatedBy)?.generatedBy,
    coverage: headers.find((h) => h.coverage)?.coverage,
    sourceFiles,
    kindsPresent,
    warnings,
    observations: all,
    contentHash: buildContentHash(all),
  };
}

function resolveExportDate(
  headers: DocumentHeader[],
  archiveNames: string[],
  observations: Observation[],
  files: RawFile[],
  warnings: ParseWarning[],
): { exportedAt: string; source: ExportDateSource } {
  const generated = [...new Set(headers.map((h) => h.generatedAt).filter(Boolean))] as string[];
  if (generated.length > 0) {
    if (generated.length > 1) {
      warnings.push({
        code: 'mixed_export_dates',
        message: `The uploaded files were generated at ${generated.length} different times. They may come from separate exports. The most recent date was used.`,
      });
    }
    const newest = generated.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b));
    return { exportedAt: newest, source: 'document_header' };
  }

  for (const name of archiveNames) {
    const fromName = dateFromArchiveName(name);
    if (fromName) return { exportedAt: fromName, source: 'zip_filename' };
  }

  const latest = observations.reduce<number | undefined>(
    (max, o) => (o.followedAt !== undefined && (max === undefined || o.followedAt > max) ? o.followedAt : max),
    undefined,
  );
  if (latest !== undefined) {
    return { exportedAt: new Date(latest).toISOString(), source: 'latest_observation' };
  }

  const modified = files.reduce<number | undefined>(
    (max, f) => (f.lastModified !== undefined && (max === undefined || f.lastModified > max) ? f.lastModified : max),
    undefined,
  );
  if (modified !== undefined) {
    return { exportedAt: new Date(modified).toISOString(), source: 'file_modified' };
  }

  warnings.push({
    code: 'no_export_date',
    message: 'No export date could be found in these files. Set it manually before saving.',
  });
  return { exportedAt: new Date().toISOString(), source: 'user_entered' };
}

/** Identity of a snapshot's *contents*, so re-uploading the same export is detectable. */
function buildContentHash(observations: Observation[]): string {
  const byKind = new Map<RelationKind, string[]>();
  for (const o of observations) {
    const list = byKind.get(o.kind) ?? [];
    list.push(o.handle);
    byKind.set(o.kind, list);
  }
  const parts = RELATION_KINDS.filter((k) => byKind.has(k)).map(
    (k) => `${k}:${byKind.get(k)!.sort().join(',')}`,
  );
  return hashString(parts.join('|'));
}
