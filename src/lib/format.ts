const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const DATE_TIME_FMT = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function formatDate(value: string | number | undefined): string {
  if (value === undefined) return 'unknown date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'unknown date' : DATE_FMT.format(date);
}

export function formatDateTime(value: string | number | undefined): string {
  if (value === undefined) return 'unknown date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'unknown date' : DATE_TIME_FMT.format(date);
}

export function formatCount(n: number): string {
  return n.toLocaleString();
}

export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${formatCount(n)} ${n === 1 ? singular : plural}`;
}
