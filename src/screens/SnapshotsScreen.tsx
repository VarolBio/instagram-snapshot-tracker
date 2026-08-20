import { useState } from 'react';
import { Button, Callout, Card, EmptyState, SectionTitle, TextInput } from '../components/ui';
import { formatCount, formatDate, formatDateTime } from '../lib/format';
import { RELATION_LABELS, type Snapshot } from '../model/types';
import { useStore } from '../state/store';

export function SnapshotsScreen({ onUpload }: { onUpload: () => void }) {
  const { snapshots, removeSnapshot, renameSnapshot } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  if (snapshots.length === 0) {
    return (
      <EmptyState
        title="No snapshots yet"
        action={
          <Button variant="primary" onClick={onUpload}>
            Upload your first export
          </Button>
        }
      >
        Your first upload becomes the baseline. Comparisons appear once you add a second one.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle hint={`${formatCount(snapshots.length)} saved, oldest first`}>
        Snapshots
      </SectionTitle>

      {snapshots.length === 1 ? (
        <Callout tone="neutral">
          One snapshot is a baseline, not a comparison. Upload another export in a few weeks to see
          what changed.
        </Callout>
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
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <h3 className="text-base font-semibold text-ink-50">{snapshot.label}</h3>
                )}
                <p className="mt-1 text-xs text-ink-500">
                  Exported {formatDate(snapshot.exportedAt)} &middot; imported{' '}
                  {formatDateTime(snapshot.importedAt)}
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
                    Rename
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
                      Really delete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="danger" onClick={() => setConfirming(snapshot.id)}>
                    Delete
                  </Button>
                )}
              </div>
            </div>

            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-ink-800 pt-3 text-sm">
              {snapshot.kindsPresent.map((kind) => (
                <div key={kind} className="flex gap-2">
                  <dt className="text-ink-500">{RELATION_LABELS[kind]}</dt>
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
          Instagram states this export covers {formatDate(snapshot.coverage.from)} to{' '}
          {formatDate(snapshot.coverage.to)}.
        </p>
      ) : null}

      {missing ? (
        <Callout tone="warning">
          This snapshot has no {!hasFollowers ? 'followers' : 'following'} list. Comparisons will
          skip that list rather than report everyone in it as gone.
        </Callout>
      ) : null}

      {snapshot.warnings.length > 0 ? (
        <details className="text-xs text-ink-500">
          <summary className="cursor-pointer hover:text-ink-300">
            {formatCount(snapshot.warnings.length)} parsing note
            {snapshot.warnings.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {snapshot.warnings.map((warning, i) => (
              <li key={`${warning.code}-${i}`}>{warning.message}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <details className="text-xs text-ink-500">
        <summary className="cursor-pointer hover:text-ink-300">Source files</summary>
        <ul className="mt-2 space-y-1">
          {snapshot.sourceFiles.map((file) => (
            <li key={file.path} className="font-mono break-all">
              {file.path} &rarr; {file.kind === 'unmatched' ? 'ignored' : RELATION_LABELS[file.kind]}{' '}
              ({formatCount(file.entryCount)})
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
