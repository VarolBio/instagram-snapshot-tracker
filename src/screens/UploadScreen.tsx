import { useState } from 'react';
import { ParseReport } from '../components/ParseReport';
import { UploadDropzone } from '../components/UploadDropzone';
import { Button, Callout, Card, SectionTitle, TextInput } from '../components/ui';
import { formatCount } from '../lib/format';
import { RELATION_LABELS, type ParsedSnapshot } from '../model/types';
import { parseUpload } from '../parser';
import { defaultLabel, useStore, type DuplicateWarning } from '../state/store';

interface Pending {
  parsed: ParsedSnapshot;
  label: string;
  exportedAt: string;
  duplicate: DuplicateWarning | null;
}

export function UploadScreen({ onSaved }: { onSaved: () => void }) {
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  async function handleFiles(files: File[]) {
    setBusy(true);
    setError(null);
    try {
      const parsed = await parseUpload(files);
      setPending({
        parsed,
        label: defaultLabel(parsed.exportedAt),
        exportedAt: parsed.exportedAt.slice(0, 10),
        duplicate: store.checkDuplicate(parsed),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!pending) return;
    const exportedAt = new Date(`${pending.exportedAt}T12:00:00.000Z`).toISOString();
    await store.addSnapshot(pending.parsed, pending.label, exportedAt);
    setPending(null);
    onSaved();
  }

  const accountCount = pending?.parsed.observations.length ?? 0;
  const nothingUsable = pending !== null && accountCount === 0;

  return (
    <div className="space-y-6">
      <UploadDropzone onFiles={handleFiles} busy={busy} />

      {error ? (
        <Callout tone="danger" title="That upload could not be read">
          {error}
        </Callout>
      ) : null}

      {pending ? (
        <div className="space-y-5">
          <div>
            <SectionTitle>Snapshot summary</SectionTitle>
            <Card className="p-4">
              <ul className="grid gap-2 sm:grid-cols-2">
                {pending.parsed.kindsPresent.map((kind) => (
                  <li key={kind} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-ink-400">{RELATION_LABELS[kind]}</span>
                    <span className="font-medium text-ink-100">
                      {formatCount(
                        pending.parsed.observations.filter((o) => o.kind === kind).length,
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {pending.parsed.generatedBy ? (
                <p className="mt-3 border-t border-ink-800 pt-3 text-xs text-ink-500">
                  Generated for @{pending.parsed.generatedBy}.
                </p>
              ) : null}
            </Card>
          </div>

          <ParseReport parsed={pending.parsed} />

          {pending.duplicate ? (
            <Callout
              tone={pending.duplicate.kind === 'identical' ? 'danger' : 'warning'}
              title={
                pending.duplicate.kind === 'identical'
                  ? 'You have already saved this export'
                  : 'A snapshot from this day already exists'
              }
            >
              {pending.duplicate.message}
            </Callout>
          ) : null}

          {nothingUsable ? (
            <Callout tone="danger" title="No accounts were found">
              None of these files contained a followers or following list. Check that you exported
              in HTML format and included the Connections category.
            </Callout>
          ) : null}

          <div>
            <SectionTitle>Save this snapshot</SectionTitle>
            <Card className="flex flex-wrap items-end gap-3 p-4">
              <label className="flex flex-col gap-1 text-xs text-ink-400">
                Name
                <TextInput
                  value={pending.label}
                  onChange={(e) => setPending({ ...pending, label: e.target.value })}
                  className="w-56"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-ink-400">
                Export date
                <TextInput
                  type="date"
                  value={pending.exportedAt}
                  onChange={(e) => setPending({ ...pending, exportedAt: e.target.value })}
                />
              </label>
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" onClick={() => setPending(null)}>
                  Discard
                </Button>
                <Button variant="primary" onClick={save} disabled={nothingUsable}>
                  {pending.duplicate?.kind === 'identical' ? 'Save anyway' : 'Save snapshot'}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <HowToExport />
      )}
    </div>
  );
}

function HowToExport() {
  return (
    <Card className="p-5">
      <SectionTitle>How to get your export</SectionTitle>
      <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-ink-400">
        <li>
          Instagram &rarr; <strong className="text-ink-200">Settings</strong> &rarr;{' '}
          <strong className="text-ink-200">Accounts Centre</strong> &rarr;{' '}
          <strong className="text-ink-200">Your information and permissions</strong> &rarr;{' '}
          <strong className="text-ink-200">Export your information</strong> &rarr;{' '}
          <strong className="text-ink-200">Create export</strong> &rarr;{' '}
          <strong className="text-ink-200">Export to device</strong>
        </li>
        <li>
          Customise information: tick only{' '}
          <strong className="text-ink-200">Followers and following</strong>
        </li>
        <li>
          Date range: <strong className="text-ink-200">All time</strong>. Format:{' '}
          <strong className="text-ink-200">HTML</strong>
        </li>
        <li>Start export. Instagram will give you a ZIP on the device, or by email.</li>
        <li>
          Drop the ZIP in above, or unzip it and drop the two HTML files (
          <strong className="text-ink-200">followers</strong> and{' '}
          <strong className="text-ink-200">following</strong>). Repeat every few weeks to build a
          history.
        </li>
      </ol>
      <p className="mt-4 text-xs text-ink-500">
        All time is required. A shorter range can leave old followers out, so the lists no longer
        match.
      </p>
    </Card>
  );
}
