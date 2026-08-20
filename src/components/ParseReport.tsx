import { formatCount, formatDate } from '../lib/format';
import { RELATION_LABELS, type ParsedSnapshot } from '../model/types';
import { Callout, Card, SectionTitle } from './ui';

const DATE_SOURCE_TEXT: Record<ParsedSnapshot['exportedAtSource'], string> = {
  document_header: 'read from the export\u2019s own header',
  zip_filename: 'taken from the ZIP filename',
  latest_observation: 'guessed from the most recent follow date in the files',
  file_modified: 'taken from the file\u2019s modification date',
  user_entered: 'not found in the files \u2014 please set it yourself',
};

/**
 * Shows exactly what was read from which file and by which strategy. This is the
 * traceability promise made concrete: nothing later in the app comes from anywhere else.
 */
export function ParseReport({ parsed }: { parsed: ParsedSnapshot }) {
  const matched = parsed.sourceFiles.filter((f) => f.kind !== 'unmatched');

  return (
    <div className="space-y-4">
      <div>
        <SectionTitle hint={`${formatCount(matched.length)} of ${formatCount(parsed.sourceFiles.length)} files used`}>
          What was read
        </SectionTitle>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-left text-xs tracking-wide text-ink-400 uppercase">
                <th className="px-4 py-2 font-medium">File</th>
                <th className="px-4 py-2 font-medium">Read as</th>
                <th className="px-4 py-2 font-medium">Accounts</th>
                <th className="px-4 py-2 font-medium">Identified by</th>
              </tr>
            </thead>
            <tbody>
              {parsed.sourceFiles.map((file) => (
                <tr key={file.path} className="border-b border-ink-800/60 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs break-all text-ink-300">{file.path}</td>
                  <td className="px-4 py-2">
                    {file.kind === 'unmatched' ? (
                      <span className="text-ink-500">Ignored</span>
                    ) : (
                      <span className="text-ink-100">{RELATION_LABELS[file.kind]}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-ink-300">{formatCount(file.entryCount)}</td>
                  <td className="px-4 py-2 text-xs text-ink-500">
                    {file.kind === 'unmatched'
                      ? '\u2014'
                      : `${file.kindSource === 'document_heading' ? 'heading in the file' : 'filename'}, ${file.extractorId ?? 'no reader matched'}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Callout tone="neutral" title="Export date">
        {formatDate(parsed.exportedAt)} &mdash; {DATE_SOURCE_TEXT[parsed.exportedAtSource]}.
        {parsed.coverage ? (
          <>
            {' '}
            Instagram states this export covers {formatDate(parsed.coverage.from)} to{' '}
            {formatDate(parsed.coverage.to)}, so anything outside that window may be missing.
          </>
        ) : null}
      </Callout>

      {parsed.warnings.length > 0 ? (
        <Callout tone="warning" title={`${parsed.warnings.length} thing${parsed.warnings.length === 1 ? '' : 's'} to know`}>
          <ul className="list-disc space-y-1 pl-4">
            {parsed.warnings.map((warning, i) => (
              <li key={`${warning.code}-${i}`}>{warning.message}</li>
            ))}
          </ul>
        </Callout>
      ) : null}
    </div>
  );
}
