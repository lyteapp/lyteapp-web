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

const STORAGE_KEY = 'lyte-locale'

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null
      if (saved === 'en' || saved === 'es') {
        setLocaleState(saved)
      } else {
        const detected = detectLocale()
        setLocaleState(detected)
        localStorage.setItem(STORAGE_KEY, detected)
      }
    } catch {
      setLocaleState(detectLocale())
    }
  }, [])

  function setLocale(l: Locale) {
    setLocaleState(l)
    try { localStorage.setItem(STORAGE_KEY, l) } catch {}
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
