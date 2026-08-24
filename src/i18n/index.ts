import { useCallback, useSyncExternalStore } from 'react';
import type { ParseWarning } from '../model/types';
import { en } from './en';
import { tr } from './tr';

export type Locale = 'en' | 'tr';
export type Vars = Record<string, string | number>;

type Node = { [key: string]: string | Node };

const dicts: Record<Locale, Node> = {
  en: en as unknown as Node,
  tr: tr as unknown as Node,
};

let current: Locale = detectLocale();
const listeners = new Set<() => void>();

export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  return navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  listeners.forEach((listen) => listen());
}

export function subscribeLocale(listen: () => void): () => void {
  listeners.add(listen);
  return () => {
    listeners.delete(listen);
  };
}

function lookup(tree: Node, key: string): string | undefined {
  let node: string | Node | undefined = tree;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function t(key: string, vars?: Vars): string {
  let text = lookup(dicts[current], key) ?? lookup(dicts.en, key) ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function interpolate(template: string, vars: Vars): string {
  let text = template;
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

export function useI18n(): { locale: Locale; t: typeof t; setLocale: typeof setLocale } {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  const translate = useCallback(
    (key: string, vars?: Vars) => {
      void locale;
      return t(key, vars);
    },
    [locale],
  );
  return { locale, t: translate, setLocale };
}

const RELATION_PARAM_KEYS = ['kind', 'fromFilename', 'fromDocument', 'witnessKind'] as const;

export function formatParseWarning(warning: ParseWarning): string {
  const params: Vars = { path: warning.path ?? '', ...(warning.params ?? {}) };
  for (const key of RELATION_PARAM_KEYS) {
    const value = params[key];
    if (typeof value === 'string' && value.length > 0) {
      const label = t(`relation.${value}`);
      if (label !== `relation.${value}`) params[key] = label;
    }
  }
  if (params.entries === undefined && params.count !== undefined) {
    params.entries = Number(params.count) === 1 ? t('parse.entry') : t('parse.entries');
  }
  return t(`parse.${warning.code}`, params);
}
