import { useState } from 'react';
import { Button, Callout, Card, EmptyState, SectionTitle, TextInput } from '../components/ui';
import { formatParseWarning, t } from '../i18n';
import { formatCount, formatDate, formatDateTime } from '../lib/format';
import { type Snapshot } from '../model/types';
import { useStore } from '../state/store';

export function SnapshotsScreen({ onUpload }: { onUpload: () => void }) {
  const { snapshots, removeSnapshot, renameSnapshot } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  if (snapshots.length === 0) {
    return (
      <EmptyState
        title={t('snapshots.emptyTitle')}
        action={
          <Button variant="primary" onClick={onUpload}>
            {t('snapshots.uploadFirst')}
          </Button>
        }
      >
        {t('snapshots.emptyBody')}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle hint={t('snapshots.saved', { count: formatCount(snapshots.length) })}>
        {t('snapshots.title')}
      </SectionTitle>

      {snapshots.length === 1 ? (
        <Callout tone="neutral">{t('snapshots.oneBaseline')}</Callout>
      ) : null}

      <ul className="space-y-3">
        {snapshots.map((snapshot) => (
          <Card as="li" key={snapshot.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                {editing === snapshot.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <TextInput
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="w-56"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={async () => {
                        await renameSnapshot(snapshot.id, draft.trim() || snapshot.label);
                        setEditing(null);
                      }}
                    >
                      {t('snapshots.save')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      {t('snapshots.cancel')}
                    </Button>
                  </div>
                ) : (
                  <h3 className="text-base font-semibold text-ink-50">{snapshot.label}</h3>
                )}
                <p className="mt-1 text-xs text-ink-500">
                  {t('snapshots.exportedImported', {
                    exported: formatDate(snapshot.exportedAt),
                    imported: formatDateTime(snapshot.importedAt),
                  })}
                  {snapshot.generatedBy ? ` \u00b7 @${snapshot.generatedBy}` : ''}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                {editing === snapshot.id ? null : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(snapshot.id);
                      setDraft(snapshot.label);
                    }}
                  >
                    {t('snapshots.rename')}
                  </Button>
                )}
                {confirming === snapshot.id ? (
                  <>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={async () => {
                        await removeSnapshot(snapshot.id);
                        setConfirming(null);
                      }}
                    >
                      {t('snapshots.reallyDelete')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                      {t('snapshots.cancel')}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="danger" onClick={() => setConfirming(snapshot.id)}>
                    {t('snapshots.delete')}
                  </Button>
                )}
              </div>
            </div>

            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-ink-800 pt-3 text-sm">
              {snapshot.kindsPresent.map((kind) => (
                <div key={kind} className="flex gap-2">
                  <dt className="text-ink-500">{t(`relation.${kind}`)}</dt>
                  <dd className="font-medium text-ink-200">
                    {formatCount(snapshot.observations.filter((o) => o.kind === kind).length)}
                  </dd>
                </div>
              ))}
            </dl>

            <Coverage snapshot={snapshot} />
          </Card>
        ))}
      </ul>
    </div>
  );
}

function Coverage({ snapshot }: { snapshot: Snapshot }) {
  const hasFollowers = snapshot.kindsPresent.includes('follower');
  const hasFollowing = snapshot.kindsPresent.includes('following');
  const missing = !hasFollowers || !hasFollowing;

  return (
    <div className="mt-3 space-y-2">
      {snapshot.coverage ? (
        <p className="text-xs text-ink-500">
          {t('snapshots.coverage', {
            from: formatDate(snapshot.coverage.from),
            to: formatDate(snapshot.coverage.to),
          })}
        </p>
      ) : null}

      {missing ? (
        <Callout tone="warning">
          {t(hasFollowers ? 'snapshots.missingFollowing' : 'snapshots.missingFollowers')}
        </Callout>
      ) : null}

      {snapshot.warnings.length > 0 ? (
        <details className="text-xs text-ink-500">
          <summary className="cursor-pointer hover:text-ink-300">
            {t(
              snapshot.warnings.length === 1 ? 'snapshots.parsingNote' : 'snapshots.parsingNotes',
              { count: formatCount(snapshot.warnings.length) },
            )}
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {snapshot.warnings.map((warning, i) => (
              <li key={`${warning.code}-${i}`}>{formatParseWarning(warning)}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <details className="text-xs text-ink-500">
        <summary className="cursor-pointer hover:text-ink-300">{t('snapshots.sourceFiles')}</summary>
        <ul className="mt-2 space-y-1">
          {snapshot.sourceFiles.map((file) => (
            <li key={file.path} className="font-mono break-all">
              {file.path} &rarr;{' '}
              {file.kind === 'unmatched' ? t('snapshots.ignored') : t(`relation.${file.kind}`)} (
              {formatCount(file.entryCount)})
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
