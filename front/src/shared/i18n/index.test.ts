import { describe, expect, it } from 'vitest';
import { normalizeLocale, t } from './index';

describe('shared i18n', () => {
  it('returns Korean messages for ko locale', () => {
    expect(t('appTitle', 'ko')).toBe('노목돈');
    expect(t('loginCta', 'ko-KR')).toBe('토스로 계속하기');
    expect(t('loading', 'ko')).toBe('로딩');
  });

  it('returns English messages for en locale', () => {
    expect(t('appTitle', 'en')).toBe('NomokDon');
    expect(t('verify', 'en-US')).toBe('Verify');
  });

  it('falls back safely for missing keys', () => {
    expect(t('missing.key' as never, 'ko')).toBe('missing.key');
  });

  it('normalizes locale variants and falls back to en', () => {
    expect(normalizeLocale('ko-KR')).toBe('ko');
    expect(normalizeLocale('EN-us')).toBe('en');
    expect(normalizeLocale('fr-FR')).toBe('en');
    expect(normalizeLocale(undefined)).toBe('en');
  });
});
