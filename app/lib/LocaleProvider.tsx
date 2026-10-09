'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { detectLocale, translations, Locale, TranslationKey } from './i18n'

type TFn = (key: TranslationKey, vars?: Record<string, string>) => string

interface LocaleCtxValue {
  t: TFn
  locale: Locale
  setLocale: (l: Locale) => void
}

const LocaleCtx = createContext<LocaleCtxValue>({
  t: (key) => key,
  locale: 'en',
  setLocale: () => {},
})

// Always follows the device's language — there's no in-app switcher, so
// nothing is persisted. The old saved choice (from when there was one) is
// cleared so it can't keep overriding the device.
const LEGACY_STORAGE_KEY = 'lyte-locale'

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')

  useEffect(() => {
    try { localStorage.removeItem(LEGACY_STORAGE_KEY) } catch {}
    setLocaleState(detectLocale())
  }, [])

  function setLocale(l: Locale) {
    setLocaleState(l)
  }

  function t(key: TranslationKey, vars?: Record<string, string>): string {
    let str = translations[locale][key] ?? translations['en'][key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, v)
      }
    }
    return str
  }

  return (
    <LocaleCtx.Provider value={{ t, locale, setLocale }}>
      {children}
    </LocaleCtx.Provider>
  )
}

export function useT(): TFn {
  return useContext(LocaleCtx).t
}

export function useLocale(): [Locale, (l: Locale) => void] {
  const { locale, setLocale } = useContext(LocaleCtx)
  return [locale, setLocale]
}
