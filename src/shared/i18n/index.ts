import { normalizeLocale as normalizeSessionLocale, type SessionLocale } from '../auth/session';
import enMessages from './en.json';
import koMessages from './ko.json';

export type Locale = SessionLocale;
export type MessageKey = keyof typeof enMessages;

const messages: Record<Locale, Record<MessageKey, string>> = {
  en: enMessages,
  ko: koMessages
};

export function normalizeLocale(locale: unknown): Locale {
  return normalizeSessionLocale(locale);
}

export function getMessages(locale: unknown): Record<MessageKey, string> {
  return messages[normalizeLocale(locale)];
}

export function t(key: MessageKey | (string & {}), locale: unknown = 'en'): string {
  const normalizedLocale = normalizeLocale(locale);
  const localizedMessages = messages[normalizedLocale];

  if (key in localizedMessages) {
    return localizedMessages[key as MessageKey];
  }

  if (key in enMessages) {
    return enMessages[key as MessageKey];
  }

  return key;
}
