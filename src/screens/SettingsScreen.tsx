import { useEffect, useRef, useState } from 'react';
import { keywordsEqual, parseKeywordList } from '../analysis/classify';
import { LimitationsPanel } from '../components/LimitationsPanel';
import { Button, Callout, Card, SectionTitle, TextArea } from '../components/ui';
import { t, useI18n } from '../i18n';
import { formatCount } from '../lib/format';
import {
  RECOMMENDED_BRAND_KEYWORD_GROUPS,
  RECOMMENDED_BRAND_KEYWORDS,
  RECOMMENDED_BRAND_SUFFIXES,
} from '../model/keywords';
import { type AccountCategory } from '../model/types';
import { parseBackup, serializeBackup } from '../storage/repo';
import { useStore } from '../state/store';

export function SettingsScreen() {
  useI18n();
  const { snapshots, settings, restore, wipe, updateSettings } = useStore();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [message, setMessage] = useState<{ tone: 'good' | 'danger'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const counts = Object.values(settings.classifications).reduce<Record<string, number>>(
    (acc, entry) => {
      acc[entry.category] = (acc[entry.category] ?? 0) + 1;
      return acc;
    },
    {},
  );

  function downloadBackup() {
    const json = serializeBackup({ snapshots, settings });
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `instagram-snapshots-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(file: File) {
    try {
      const data = parseBackup(await file.text());
      await restore(data);
      const count = formatCount(data.snapshots.length);
      setMessage({
        tone: 'good',
        text: t(data.snapshots.length === 1 ? 'settings.restored' : 'settings.restoredPlural', {
          count,
        }),
      });
    } catch (error) {
      setMessage({ tone: 'danger', text: error instanceof Error ? error.message : String(error) });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>{t('settings.yourData')}</SectionTitle>
        <Card className="space-y-4 p-5">
          <p className="text-sm text-ink-400">{t('settings.dataBody')}</p>

          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-ink-500">{t('settings.snapshots')}</dt>
              <dd className="font-medium text-ink-200">{formatCount(snapshots.length)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-500">{t('settings.classified')}</dt>
              <dd className="font-medium text-ink-200">
                {formatCount(Object.keys(settings.classifications).length)}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-500">{t('settings.dismissedRenames')}</dt>
              <dd className="font-medium text-ink-200">
                {formatCount(settings.dismissedRenames.length)}
              </dd>
            </div>
          </dl>

          {Object.keys(counts).length > 0 ? (
            <ul className="flex flex-wrap gap-2 text-xs">
              {Object.entries(counts).map(([category, count]) => (
                <li key={category} className="rounded-full border border-ink-700 px-2.5 py-1 text-ink-300">
                  {t(`category.${category as AccountCategory}`)}: {formatCount(count)}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-ink-800 pt-4">
            <Button variant="ghost" onClick={downloadBackup} disabled={snapshots.length === 0}>
              {t('settings.downloadBackup')}
            </Button>
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
              {t('settings.restoreBackup')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importBackup(file);
                e.target.value = '';
              }}
            />
          </div>

          {message ? <Callout tone={message.tone}>{message.text}</Callout> : null}
        </Card>
      </div>

      <KeywordEditor
        keywords={settings.brandKeywords}
        onSave={(keywords) => updateSettings({ brandKeywords: keywords })}
      />

      <div>
        <SectionTitle>{t('settings.deleteEverything')}</SectionTitle>
        <Card className="space-y-3 p-5">
          <p className="text-sm text-ink-400">{t('settings.deleteBody')}</p>
          {confirmWipe ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger"
                onClick={async () => {
                  await wipe();
                  setConfirmWipe(false);
                  setMessage({ tone: 'good', text: t('settings.deleted') });
                }}
              >
                {t('settings.yesDelete')}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmWipe(false)}>
                {t('settings.cancel')}
              </Button>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirmWipe(true)}>
              {t('settings.deleteAll')}
            </Button>
          )}
        </Card>
      </div>

      <LimitationsPanel />
    </div>
  );
}

function KeywordEditor({
  keywords,
  onSave,
}: {
  keywords: string[];
  onSave: (keywords: string[]) => void | Promise<void>;
}) {
  useI18n();
  const [draft, setDraft] = useState(() => keywords.join('\n'));

  useEffect(() => {
    setDraft(keywords.join('\n'));
  }, [keywords]);
  const parsed = parseKeywordList(draft);
  const dirty = !keywordsEqual(parsed.keywords, keywords);
  const usingRecommended = keywordsEqual(keywords, RECOMMENDED_BRAND_KEYWORDS);

  return (
    <div>
      <SectionTitle>{t('settings.keywordsTitle')}</SectionTitle>
      <Card className="space-y-4 p-5">
        <p className="text-sm text-ink-400">{t('settings.keywordsBody')}</p>

        <div className="flex flex-wrap gap-2">
          {Object.entries(RECOMMENDED_BRAND_KEYWORD_GROUPS).map(([group, words]) => (
            <span
              key={group}
              className="rounded-full border border-ink-700 px-2.5 py-1 text-[11px] text-ink-400"
              title={words.join(', ')}
            >
              {t(`keywordGroup.${group}`)} · {words.length}
            </span>
          ))}
          <span
            className="rounded-full border border-ink-700 px-2.5 py-1 text-[11px] text-ink-400"
            title={RECOMMENDED_BRAND_SUFFIXES.join(', ')}
          >
            {t('settings.domains')} · {RECOMMENDED_BRAND_SUFFIXES.length}
          </span>
        </div>

        <label className="block text-xs text-ink-400">
          {t('settings.yourList')}
          <TextArea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={16}
            spellCheck={false}
            className="mt-1"
          />
        </label>

        {parsed.ignored.length > 0 ? (
          <Callout tone="warning" title={t('settings.tooShort')}>
            {t('settings.ignored', { list: parsed.ignored.join(', ') })}
          </Callout>
        ) : null}

        <p className="text-xs text-ink-500">
          {t(parsed.keywords.length === 1 ? 'settings.keywordCount' : 'settings.keywordCountPlural', {
            count: formatCount(parsed.keywords.length),
          })}
          {usingRecommended ? t('settings.recommended') : ''}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={!dirty} onClick={() => onSave(parsed.keywords)}>
            {t('settings.saveKeywords')}
          </Button>
          <Button
            variant="ghost"
            disabled={usingRecommended && !dirty}
            onClick={() => {
              const next = [...RECOMMENDED_BRAND_KEYWORDS];
              setDraft(next.join('\n'));
              void onSave(next);
            }}
          >
            {t('settings.resetRecommended')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
