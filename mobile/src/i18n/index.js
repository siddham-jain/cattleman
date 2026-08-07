/**
 * Localisation.
 *
 * The people doing the registrations are field workers and farmers, and English
 * is not the working language for most of them. Hindi is not a nicety here — an
 * English-only app would be unusable for a large share of its intended users.
 *
 * The device locale is the default, but the choice is overridable and persisted:
 * a shared or hand-me-down handset often carries someone else's locale.
 */
import { useEffect, useState } from 'react';
import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';

const LOCALE_KEY = 'cattleman.locale';

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
];

export const i18n = new I18n({ en, hi, mr });

// Fall back to English rather than showing raw keys when a string is missing.
i18n.enableFallback = true;
i18n.defaultLocale = 'en';
i18n.locale = Localization.getLocales()[0]?.languageCode ?? 'en';

export async function restoreLocale() {
  const stored = await AsyncStorage.getItem(LOCALE_KEY);
  if (stored && SUPPORTED_LOCALES.some((l) => l.code === stored)) {
    i18n.locale = stored;
  }
  return i18n.locale;
}

const listeners = new Set();

export async function setLocale(code) {
  i18n.locale = code;
  await AsyncStorage.setItem(LOCALE_KEY, code);
  listeners.forEach((listener) => listener(code));
}

/**
 * Re-render on a language change.
 *
 * i18n-js reads the locale at call time, so nothing above it knows a switch has
 * happened. The app subscribes at the root and remounts the navigator, which is
 * what makes screen titles change with everything else.
 */
export function useLocale() {
  const [locale, setLocaleState] = useState(i18n.locale);
  useEffect(() => {
    listeners.add(setLocaleState);
    return () => listeners.delete(setLocaleState);
  }, []);
  return locale;
}

export function t(key, options) {
  return i18n.t(key, options);
}
