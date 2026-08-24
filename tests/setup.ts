import { setLocale } from '../src/i18n';

Object.defineProperty(navigator, 'language', {
  configurable: true,
  get: () => 'en-GB',
});

setLocale('en');
