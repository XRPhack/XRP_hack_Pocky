export const SESSION_STORAGE_KEY = 'nomokdon.session';

export type SessionLocale = 'en' | 'ko';

export interface Session {
  userId: string;
  name: string;
  phone: string;
  locale: SessionLocale;
  tenantWalletAddress?: string;
}

export interface TossOAuthMockSessionInput {
  userId: string;
  name: string;
  phone: string;
  locale?: string;
  tenantWalletAddress?: string;
  [key: string]: unknown;
}

type SessionStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const DEFAULT_LOCALE: SessionLocale = 'en';
const SUPPORTED_LOCALES = new Set<SessionLocale>(['en', 'ko']);
const SESSION_ID_PREFIX = 'sess_';

const sessionById = new Map<string, Session>();
let activeSessionId: string | null = null;

const memoryStorage = new Map<string, string>();

const memoryStorageAdapter: SessionStorageLike = {
  getItem(key) {
    return memoryStorage.get(key) ?? null;
  },
  setItem(key, value) {
    memoryStorage.set(key, value);
  },
  removeItem(key) {
    memoryStorage.delete(key);
  }
};

function getStorage(): SessionStorageLike {
  const storage = globalThis.localStorage;

  if (!storage) {
    return memoryStorageAdapter;
  }

  try {
    storage.getItem(SESSION_STORAGE_KEY);
    return storage;
  } catch {
    return memoryStorageAdapter;
  }
}

export function normalizeLocale(locale: unknown): SessionLocale {
  if (typeof locale !== 'string') {
    return DEFAULT_LOCALE;
  }

  const normalized = locale.trim().toLowerCase();

  if (SUPPORTED_LOCALES.has(normalized as SessionLocale)) {
    return normalized as SessionLocale;
  }

  if (normalized.startsWith('ko')) {
    return 'ko';
  }

  if (normalized.startsWith('en')) {
    return 'en';
  }

  return DEFAULT_LOCALE;
}

function sanitizeSession(session: TossOAuthMockSessionInput): Session {
  const sanitized: Session = {
    userId: session.userId,
    name: session.name,
    phone: session.phone,
    locale: normalizeLocale(session.locale)
  };

  if (typeof session.tenantWalletAddress === 'string' && session.tenantWalletAddress.trim()) {
    sanitized.tenantWalletAddress = session.tenantWalletAddress;
  }

  return sanitized;
}

function createSessionId(): string {
  const crypto = globalThis.crypto;

  if (crypto && typeof crypto.randomUUID === 'function') {
    return `${SESSION_ID_PREFIX}${crypto.randomUUID()}`;
  }

  return `${SESSION_ID_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function getActiveSessionId(): string | null {
  if (activeSessionId) {
    return activeSessionId;
  }

  const stored = getStorage().getItem(SESSION_STORAGE_KEY);

  return stored && stored.startsWith(SESSION_ID_PREFIX) ? stored : null;
}

export function setSession(session: TossOAuthMockSessionInput): Session {
  const sanitized = sanitizeSession(session);
  const sessionId = createSessionId();

  sessionById.set(sessionId, sanitized);
  activeSessionId = sessionId;
  getStorage().setItem(SESSION_STORAGE_KEY, sessionId);

  return sanitized;
}

export function getSession(): Session | null {
  const sessionId = getActiveSessionId();

  if (!sessionId) {
    return null;
  }

  return sessionById.get(sessionId) ?? null;
}

export function clearSession(): void {
  const sessionId = getActiveSessionId();

  if (sessionId) {
    sessionById.delete(sessionId);
  }

  activeSessionId = null;
  getStorage().removeItem(SESSION_STORAGE_KEY);
}
