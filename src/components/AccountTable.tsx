import { useMemo, useState } from 'react';
import type { AccountRow } from '../analysis/currentState';
import { t } from '../i18n';
import { formatCount, formatDate } from '../lib/format';
import { type AccountCategory, type AccountClassification } from '../model/types';
import { Card, Checkbox, EmptyState, Select, TextInput, cx } from './ui';

type SortKey = 'handle' | 'followedYouAt' | 'youFollowedAt';

export interface AccountTableProps {
  rows: AccountRow[];
  classifications: Record<string, AccountClassification>;
  onOpenAccount: (handle: string) => void;
  onClassify: (handle: string, category: AccountCategory) => void;
  emptyTitle: string;
  emptyBody?: string;
  /** Non-followers screen defaults this on so creators and brands are out of the way. */
  hideNonPersonal?: boolean;
  onHideNonPersonalChange?: (value: boolean) => void;
}

const CATEGORY_ORDER: AccountCategory[] = ['personal', 'creator', 'business', 'unknown'];

export function AccountTable({
  rows,
  classifications,
  onOpenAccount,
  onClassify,
  emptyTitle,
  emptyBody,
  hideNonPersonal,
  onHideNonPersonalChange,
}: AccountTableProps) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('handle');
  const [category, setCategory] = useState<AccountCategory | 'all'>('all');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let result = rows;

    if (needle) result = result.filter((r) => r.handle.includes(needle));
    if (category !== 'all') {
      result = result.filter((r) => (classifications[r.handle]?.category ?? 'unknown') === category);
    }
    if (hideNonPersonal) {
      result = result.filter((r) => {
        const assigned = classifications[r.handle]?.category;
        return assigned !== 'creator' && assigned !== 'business';
      });
    }

    return [...result].sort((a, b) => {
      if (sort === 'handle') return a.handle.localeCompare(b.handle);
      // Most recent first, and accounts with no date sink to the bottom.
      const av = a[sort] ?? -Infinity;
      const bv = b[sort] ?? -Infinity;
      return bv - av;
    });
  }, [rows, query, category, sort, classifications, hideNonPersonal]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <TextInput
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('table.search')}
          aria-label={t('table.search')}
          className="min-w-52 flex-1"
        />
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label={t('table.sort')}
        >
          <option value="handle">{t('table.sortHandle')}</option>
          <option value="followedYouAt">{t('table.sortFollowedYou')}</option>
          <option value="youFollowedAt">{t('table.sortYouFollowed')}</option>
        </Select>
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value as AccountCategory | 'all')}
          aria-label={t('table.filterCategory')}
        >
          <option value="all">{t('table.allCategories')}</option>
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {t(`category.${c}`)}
            </option>
          ))}
        </Select>
        {onHideNonPersonalChange ? (
          <Checkbox
            checked={hideNonPersonal ?? false}
            onChange={onHideNonPersonalChange}
            label={t('table.hideNonPersonal')}
          />
        ) : null}
      </div>

      {visible.length === 0 ? (
        <EmptyState title={emptyTitle}>{emptyBody}</EmptyState>
      ) : (
        <>
          <p className="text-xs text-ink-500">
            {t('table.showing', { visible: formatCount(visible.length), total: formatCount(rows.length) })}
          </p>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className="border-b border-ink-800 text-left text-xs tracking-wide text-ink-400 uppercase">
                    <th className="px-4 py-2 font-medium">{t('table.account')}</th>
                    <th className="px-4 py-2 font-medium">{t('table.relationship')}</th>
                    <th className="px-4 py-2 font-medium">{t('table.theyFollowed')}</th>
                    <th className="px-4 py-2 font-medium">{t('table.youFollowed')}</th>
                    <th className="px-4 py-2 font-medium">{t('table.category')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.handle} className="border-b border-ink-800/60 last:border-0">
                      <td className="px-4 py-2">
                        <button
                          onClick={() => onOpenAccount(row.handle)}
                          className="font-medium text-ink-100 hover:text-violet-300 hover:underline"
                          title={t('table.openTimeline')}
                        >
                          @{row.displayHandle}
                        </button>
                      </td>
                      <td className="px-4 py-2">
                        <Relationship row={row} />
                      </td>
                      <td className="px-4 py-2 text-ink-400">
                        {row.isFollower ? formatDate(row.followedYouAt) : '—'}
                      </td>
                      <td className="px-4 py-2 text-ink-400">
                        {row.isFollowing ? formatDate(row.youFollowedAt) : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <Select
                          value={classifications[row.handle]?.category ?? 'unknown'}
                          onChange={(e) => onClassify(row.handle, e.target.value as AccountCategory)}
                          aria-label={t('table.categoryFor', { handle: row.handle })}
                          className="py-1 text-xs"
                        >
                          {CATEGORY_ORDER.map((c) => (
                            <option key={c} value={c}>
                              {t(`category.${c}`)}
                            </option>
                          ))}
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Relationship({ row }: { row: AccountRow }) {
  const [text, tone] =
    row.isFollower && row.isFollowing
      ? [t('table.mutual'), 'text-emerald-300']
      : row.isFollowing
        ? [t('table.youFollowThem'), 'text-amber-300']
        : [t('table.theyFollowYou'), 'text-sky-300'];
  return <span className={cx('text-xs font-medium', tone)}>{text}</span>;
}

export function OpenProfileLink({ handle }: { handle: string }) {
  return (
    <a
      href={`https://www.instagram.com/${handle}`}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center rounded-lg border border-ink-700 px-2.5 py-1 text-xs font-medium text-ink-200 hover:border-ink-600 hover:text-ink-50"
    >
      {t('table.openInstagram')}
    </a>
  );
}
