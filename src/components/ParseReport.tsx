import { formatCount, formatDate } from '../lib/format';
import { formatParseWarning, t } from '../i18n';
import type { ParsedSnapshot } from '../model/types';
import { Callout, Card, SectionTitle } from './ui';

/**
 * Shows exactly what was read from which file and by which strategy. This is the
 * traceability promise made concrete: nothing later in the app comes from anywhere else.
 */
export function ParseReport({ parsed }: { parsed: ParsedSnapshot }) {
  const matched = parsed.sourceFiles.filter((f) => f.kind !== 'unmatched');

  return (
    <div className="space-y-4">
      <div>
        <SectionTitle hint={t('parse.filesUsed', { used: formatCount(matched.length), total: formatCount(parsed.sourceFiles.length) })}>
          {t('parse.whatWasRead')}
        </SectionTitle>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-left text-xs tracking-wide text-ink-400 uppercase">
                <th className="px-4 py-2 font-medium">{t('parse.file')}</th>
                <th className="px-4 py-2 font-medium">{t('parse.readAs')}</th>
                <th className="px-4 py-2 font-medium">{t('parse.accounts')}</th>
                <th className="px-4 py-2 font-medium">{t('parse.identifiedBy')}</th>
              </tr>
            </thead>
            <tbody>
              {parsed.sourceFiles.map((file) => (
                <tr key={file.path} className="border-b border-ink-800/60 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs break-all text-ink-300">{file.path}</td>
                  <td className="px-4 py-2">
                    {file.kind === 'unmatched' ? (
                      <span className="text-ink-500">{t('parse.ignored')}</span>
                    ) : (
                      <span className="text-ink-100">{t(`relation.${file.kind}`)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-ink-300">{formatCount(file.entryCount)}</td>
                  <td className="px-4 py-2 text-xs text-ink-500">
                    {file.kind === 'unmatched'
                      ? '\u2014'
                      : `${file.kindSource === 'document_heading' ? t('parse.heading') : t('parse.filename')}, ${file.extractorId ?? t('parse.noReader')}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Callout tone="neutral" title={t('parse.exportDate')}>
        {formatDate(parsed.exportedAt)} &mdash; {t(`parse.dateSource.${parsed.exportedAtSource}`)}.
        {parsed.coverage ? (
          <>
            {' '}
            {t('parse.coverage', {
              from: formatDate(parsed.coverage.from),
              to: formatDate(parsed.coverage.to),
            })}
          </>
        ) : null}
      </Callout>

      {parsed.warnings.length > 0 ? (
        <Callout
          tone="warning"
          title={
            parsed.warnings.length === 1
              ? t('parse.thingsToKnow', { count: formatCount(parsed.warnings.length) })
              : t('parse.thingsToKnowPlural', { count: formatCount(parsed.warnings.length) })
          }
        >
          <ul className="list-disc space-y-1 pl-4">
            {parsed.warnings.map((warning, i) => (
              <li key={`${warning.code}-${i}`}>{formatParseWarning(warning)}</li>
            ))}
          </ul>
        </Callout>
      ) : null}
    </div>
  );
}
