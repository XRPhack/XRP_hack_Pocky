import { beforeEach, describe, expect, it } from 'vitest';
import { clearSession, getLocalePreference, getSession, LOCALE_STORAGE_KEY, SESSION_STORAGE_KEY, setLocalePreference, setSession } from './session';

function createLocalStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

let localStorageMock: ReturnType<typeof createLocalStorageMock>;
let sessionStorageMock: ReturnType<typeof createLocalStorageMock>;

describe('auth session store', () => {
  beforeEach(() => {
    localStorageMock = createLocalStorageMock();
    sessionStorageMock = createLocalStorageMock();

    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: sessionStorageMock,
      configurable: true,
      writable: true
    });
    clearSession();
  });

  it('sets, gets, and clears a sanitized session', () => {
    const session = setSession({
      userId: 'user-1',
      name: 'Jin',
      phone: '+82-10-1234-5678',
      locale: 'ko-KR',
      tenantWalletAddress: 'rTenantWallet',
      seed: 's████',
      secret: 'secret-value',
      privateKey: 'private-key-value'
    } as never);

    expect(session).toEqual({
      userId: 'user-1',
      name: 'Jin',
      phone: '+82-10-1234-5678',
      locale: 'ko',
      tenantWalletAddress: 'rTenantWallet'
    });

    const stored = localStorageMock.getItem(SESSION_STORAGE_KEY);

    expect(stored).toBeTypeOf('string');
    expect(stored).toMatch(/^sess_/);
    expect(stored).not.toContain('Jin');
    expect(stored).not.toContain('+82-10-1234-5678');
    expect(stored).not.toContain('rTenantWallet');
    expect(stored).not.toContain('seed');
    expect(stored).not.toContain('secret');
    expect(stored).not.toContain('privateKey');
    expect(stored).not.toContain('{');
    expect(stored).not.toContain('"');
    expect(getSession()).toEqual(session);

    clearSession();

    expect(getSession()).toBeNull();
    expect(localStorageMock.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('defaults locale to en when omitted or invalid', () => {
    expect(
      setSession({
        userId: 'user-2',
        name: 'Mina',
        phone: '+82-10-0000-0000'
      })
    ).toMatchObject({ locale: 'en' });

    expect(
      setSession({
        userId: 'user-3',
        name: 'Alex',
        phone: '+82-10-9999-9999',
        locale: 'fr-FR'
      })
    ).toMatchObject({ locale: 'en' });
  });

  it('accepts supported locale variants', () => {
    expect(
      setSession({
        userId: 'user-4',
        name: 'Soo',
        phone: '+82-10-1111-2222',
        locale: 'en-US'
      })
    ).toMatchObject({ locale: 'en' });

    expect(
      setSession({
        userId: 'user-5',
        name: 'Hana',
        phone: '+82-10-3333-4444',
        locale: 'ko-KR'
      })
    ).toMatchObject({ locale: 'ko' });
  });

  it('stores only a session id in browser storage', () => {
    setSession({
      userId: 'user-6',
      name: 'Rin',
      phone: '+82-10-5555-6666',
      locale: 'en-US',
      tenantWalletAddress: 'rTenantWallet',
      seed: 'top-secret',
      secret: 'also-secret',
      privateKey: 'private-secret'
    } as never);

    const stored = localStorageMock.getItem(SESSION_STORAGE_KEY);

    expect(stored).toMatch(/^sess_/);
    expect(stored).not.toContain('Rin');
    expect(stored).not.toContain('5555');
    expect(stored).not.toContain('rTenantWallet');
    expect(stored).not.toContain('top-secret');
    expect(stored).not.toContain('also-secret');
    expect(stored).not.toContain('private-secret');
  });

  it('persists locale preference outside the session id', () => {
    expect(setLocalePreference('ko-KR')).toBe('ko');
    expect(getLocalePreference('en-US')).toBe('ko');
    expect(sessionStorageMock.getItem(LOCALE_STORAGE_KEY)).toBe('ko');
    expect(localStorageMock.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});
