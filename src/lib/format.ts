import { getLocale, t } from '../i18n';

function localeTag(): string {
  return getLocale() === 'tr' ? 'tr-TR' : 'en-GB';
}

export function formatDate(value: string | number | undefined): string {
  if (value === undefined) return t('format.unknownDate');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t('format.unknownDate');
  return new Intl.DateTimeFormat(localeTag(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | number | undefined): string {
  if (value === undefined) return t('format.unknownDate');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t('format.unknownDate');
  return new Intl.DateTimeFormat(localeTag(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatCount(n: number): string {
  return n.toLocaleString(localeTag());
}

export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${formatCount(n)} ${n === 1 ? singular : plural}`;
}
