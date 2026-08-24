import { useState } from 'react';
import { ParseReport } from '../components/ParseReport';
import { UploadDropzone } from '../components/UploadDropzone';
import { Button, Callout, Card, SectionTitle, TextInput } from '../components/ui';
import { t } from '../i18n';
import { formatCount } from '../lib/format';
import type { ParsedSnapshot } from '../model/types';
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
        <Callout tone="danger" title={t('upload.couldNotRead')}>
          {error}
        </Callout>
      ) : null}

      {pending ? (
        <div className="space-y-5">
          <div>
            <SectionTitle>{t('upload.summary')}</SectionTitle>
            <Card className="p-4">
              <ul className="grid gap-2 sm:grid-cols-2">
                {pending.parsed.kindsPresent.map((kind) => (
                  <li key={kind} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-ink-400">{t(`relation.${kind}`)}</span>
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
                  {t('upload.generatedFor', { handle: pending.parsed.generatedBy })}
                </p>
              ) : null}
            </Card>
          </div>

          <ParseReport parsed={pending.parsed} />

          {pending.duplicate ? (
            <Callout
              tone={pending.duplicate.kind === 'identical' ? 'danger' : 'warning'}
              title={
                pending.duplicate.kind === 'identical' ? t('upload.alreadySaved') : t('upload.sameDay')
              }
            >
              {pending.duplicate.kind === 'identical'
                ? t('upload.duplicateIdentical', { label: pending.duplicate.existing.label })
                : t('upload.duplicateSameDay', { label: pending.duplicate.existing.label })}
            </Callout>
          ) : null}

          {nothingUsable ? (
            <Callout tone="danger" title={t('upload.noAccounts')}>
              {t('upload.noAccountsBody')}
            </Callout>
          ) : null}

          <div>
            <SectionTitle>{t('upload.saveTitle')}</SectionTitle>
            <Card className="flex flex-wrap items-end gap-3 p-4">
              <label className="flex flex-col gap-1 text-xs text-ink-400">
                {t('upload.name')}
                <TextInput
                  value={pending.label}
                  onChange={(e) => setPending({ ...pending, label: e.target.value })}
                  className="w-56"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-ink-400">
                {t('upload.exportDate')}
                <TextInput
                  type="date"
                  value={pending.exportedAt}
                  onChange={(e) => setPending({ ...pending, exportedAt: e.target.value })}
                />
              </label>
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" onClick={() => setPending(null)}>
                  {t('upload.discard')}
                </Button>
                <Button variant="primary" onClick={save} disabled={nothingUsable}>
                  {pending.duplicate?.kind === 'identical' ? t('upload.saveAnyway') : t('upload.saveSnapshot')}
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
      <SectionTitle>{t('upload.howTo')}</SectionTitle>
      <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-ink-400">
        <li>
          Instagram &rarr; <strong className="text-ink-200">{t('upload.step1Settings')}</strong> &rarr;{' '}
          <strong className="text-ink-200">{t('upload.step1Centre')}</strong> &rarr;{' '}
          <strong className="text-ink-200">{t('upload.step1Permissions')}</strong> &rarr;{' '}
          <strong className="text-ink-200">{t('upload.step1Export')}</strong> &rarr;{' '}
          <strong className="text-ink-200">{t('upload.step1Create')}</strong> &rarr;{' '}
          <strong className="text-ink-200">{t('upload.step1Device')}</strong>
        </li>
        <li>
          {t('upload.step2Prefix')}{' '}
          <strong className="text-ink-200">{t('upload.step2Strong')}</strong>
        </li>
        <li>
          {t('upload.step3Range')} <strong className="text-ink-200">{t('upload.step3AllTime')}</strong>.{' '}
          {t('upload.step3Format')} <strong className="text-ink-200">{t('upload.step3Html')}</strong>
        </li>
        <li>{t('upload.step4')}</li>
        <li>
          {t('upload.step5Prefix')}
          <strong className="text-ink-200">followers</strong> {t('upload.step5And')}{' '}
          <strong className="text-ink-200">following</strong>
          {t('upload.step5Suffix')}
        </li>
      </ol>
      <p className="mt-4 text-xs text-ink-500">{t('upload.allTimeNote')}</p>
    </Card>
  );
}
