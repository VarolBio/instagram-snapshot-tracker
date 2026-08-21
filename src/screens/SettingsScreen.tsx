import { useEffect, useRef, useState } from 'react';
import { keywordsEqual, parseKeywordList } from '../analysis/classify';
import { LimitationsPanel } from '../components/LimitationsPanel';
import { Button, Callout, Card, SectionTitle, TextArea } from '../components/ui';
import { formatCount } from '../lib/format';
import {
  RECOMMENDED_BRAND_KEYWORD_GROUPS,
  RECOMMENDED_BRAND_KEYWORDS,
  RECOMMENDED_BRAND_SUFFIXES,
} from '../model/keywords';
import { ACCOUNT_CATEGORY_LABELS, type AccountCategory } from '../model/types';
import { parseBackup, serializeBackup } from '../storage/repo';
import { useStore } from '../state/store';

export function SettingsScreen() {
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
      setMessage({
        tone: 'good',
        text: `Restored ${formatCount(data.snapshots.length)} snapshot${data.snapshots.length === 1 ? '' : 's'}.`,
      });
    } catch (error) {
      setMessage({ tone: 'danger', text: error instanceof Error ? error.message : String(error) });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Your data</SectionTitle>
        <Card className="space-y-4 p-5">
          <p className="text-sm text-ink-400">
            Everything lives in this browser&rsquo;s IndexedDB storage on this device. It is never
            sent anywhere. Clearing your browser data, or using a different browser or device, means
            starting over &mdash; so keep a backup if the history matters to you.
          </p>

          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-ink-500">Snapshots</dt>
              <dd className="font-medium text-ink-200">{formatCount(snapshots.length)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-500">Classified accounts</dt>
              <dd className="font-medium text-ink-200">
                {formatCount(Object.keys(settings.classifications).length)}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-500">Dismissed rename suggestions</dt>
              <dd className="font-medium text-ink-200">
                {formatCount(settings.dismissedRenames.length)}
              </dd>
            </div>
          </dl>

          {Object.keys(counts).length > 0 ? (
            <ul className="flex flex-wrap gap-2 text-xs">
              {Object.entries(counts).map(([category, count]) => (
                <li key={category} className="rounded-full border border-ink-700 px-2.5 py-1 text-ink-300">
                  {ACCOUNT_CATEGORY_LABELS[category as AccountCategory]}: {formatCount(count)}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-ink-800 pt-4">
            <Button variant="ghost" onClick={downloadBackup} disabled={snapshots.length === 0}>
              Download backup
            </Button>
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
              Restore from backup
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
        <SectionTitle>Delete everything</SectionTitle>
        <Card className="space-y-3 p-5">
          <p className="text-sm text-ink-400">
            Removes every snapshot, every category you set, and the database itself. This cannot be
            undone, and a backup is the only way back.
          </p>
          {confirmWipe ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger"
                onClick={async () => {
                  await wipe();
                  setConfirmWipe(false);
                  setMessage({ tone: 'good', text: 'All local data deleted.' });
                }}
              >
                Yes, delete all my data
              </Button>
              <Button variant="ghost" onClick={() => setConfirmWipe(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirmWipe(true)}>
              Delete all data
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
  const [draft, setDraft] = useState(() => keywords.join('\n'));

  useEffect(() => {
    setDraft(keywords.join('\n'));
  }, [keywords]);
  const parsed = parseKeywordList(draft);
  const dirty = !keywordsEqual(parsed.keywords, keywords);
  const usingRecommended = keywordsEqual(keywords, RECOMMENDED_BRAND_KEYWORDS);

  return (
    <div>
      <SectionTitle>Organisation keyword guesses</SectionTitle>
      <Card className="space-y-4 p-5">
        <p className="text-sm text-ink-400">
          Usernames are matched against these fragments, entirely in this browser. A hit is a
          suggestion to mark the account as a brand, never an automatic classification. Words
          under 3 characters are ignored, except tv, which only matches at the end of a
          username. If you saved an older list, use Reset to recommended to pick up the new
          words.
        </p>

        <div className="flex flex-wrap gap-2">
          {Object.entries(RECOMMENDED_BRAND_KEYWORD_GROUPS).map(([group, words]) => (
            <span
              key={group}
              className="rounded-full border border-ink-700 px-2.5 py-1 text-[11px] text-ink-400"
              title={words.join(', ')}
            >
              {group} · {words.length}
            </span>
          ))}
          <span
            className="rounded-full border border-ink-700 px-2.5 py-1 text-[11px] text-ink-400"
            title={RECOMMENDED_BRAND_SUFFIXES.join(', ')}
          >
            Domains · {RECOMMENDED_BRAND_SUFFIXES.length}
          </span>
        </div>

        <label className="block text-xs text-ink-400">
          Your list (one per line, or separated by commas)
          <TextArea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          rows={16}
            spellCheck={false}
            className="mt-1"
          />
        </label>

        {parsed.ignored.length > 0 ? (
          <Callout tone="warning" title="Too short to use safely">
            Ignored: {parsed.ignored.join(', ')}
          </Callout>
        ) : null}

        <p className="text-xs text-ink-500">
          {formatCount(parsed.keywords.length)} keyword{parsed.keywords.length === 1 ? '' : 's'}
          {usingRecommended ? ' · this is the recommended list' : ''}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            disabled={!dirty}
            onClick={() => onSave(parsed.keywords)}
          >
            Save keywords
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
            Reset to recommended
          </Button>
        </div>
      </Card>
    </div>
  );
}
