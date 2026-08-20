import { unzip } from 'fflate';
import type { ParseWarning } from '../model/types';

export interface RawFile {
  /** Path inside the ZIP, or the plain filename for a directly uploaded file. */
  path: string;
  text: string;
  bytes: number;
  lastModified?: number;
}

export interface CollectResult {
  files: RawFile[];
  warnings: ParseWarning[];
  /** Names of the ZIPs the user supplied, used to recover an export date. */
  archiveNames: string[];
}

const decoder = new TextDecoder('utf-8');

function isZip(file: File): boolean {
  return file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip';
}

function isHtml(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith('.html') || lower.endsWith('.htm');
}

/** Archive noise that is never part of the export itself. */
function isJunk(path: string): boolean {
  return path.startsWith('__MACOSX/') || basenameOf(path).startsWith('.');
}

function basenameOf(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}

function unzipHtml(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(
      bytes,
      { filter: (entry) => isHtml(entry.name) && !isJunk(entry.name) },
      (err, data) => (err ? reject(err) : resolve(data)),
    );
  });
}

/**
 * Flattens whatever the user dropped - ZIP archives, loose HTML files, or both -
 * into a single list of decoded HTML documents.
 */
export async function collectFiles(inputs: File[]): Promise<CollectResult> {
  const files: RawFile[] = [];
  const warnings: ParseWarning[] = [];
  const archiveNames: string[] = [];

  for (const input of inputs) {
    if (isZip(input)) {
      archiveNames.push(input.name);
      try {
        const buffer = new Uint8Array(await input.arrayBuffer());
        const entries = await unzipHtml(buffer);
        for (const [path, bytes] of Object.entries(entries)) {
          if (bytes.length === 0) continue;
          files.push({
            path,
            text: decoder.decode(bytes),
            bytes: bytes.length,
            lastModified: input.lastModified,
          });
        }
        if (Object.keys(entries).length === 0) {
          warnings.push({
            code: 'unreadable_file',
            message: `${input.name} contains no HTML files. If you exported in JSON format, re-request the export in HTML.`,
            path: input.name,
          });
        }
      } catch (error) {
        warnings.push({
          code: 'unreadable_file',
          message: `Could not read ${input.name} as a ZIP archive: ${errorText(error)}`,
          path: input.name,
        });
      }
      continue;
    }

    if (!isHtml(input.name)) {
      warnings.push({
        code: 'unmatched_file',
        message: `Skipped ${input.name}: only .html files and .zip archives are read.`,
        path: input.name,
      });
      continue;
    }

    try {
      const buffer = new Uint8Array(await input.arrayBuffer());
      files.push({
        path: input.name,
        text: decoder.decode(buffer),
        bytes: buffer.length,
        lastModified: input.lastModified,
      });
    } catch (error) {
      warnings.push({
        code: 'unreadable_file',
        message: `Could not read ${input.name}: ${errorText(error)}`,
        path: input.name,
      });
    }
  }

  return { files, warnings, archiveNames };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
