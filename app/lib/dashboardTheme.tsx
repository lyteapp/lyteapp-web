'use client'

import { createContext, useContext, useLayoutEffect, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'

// Dashboard color themes. Each one re-maps the --lyte-* palette variables
// the dashboard UI is built on (see globals.css), so picking a theme only
// recolors LyteApp's own panel — never anyone's storefront.
export type DashboardThemeId = 'lyte' | 'violeta' | 'oceano' | 'esmeralda' | 'atardecer' | 'rosa' | 'grafito'

type Palette = {
  navy: string; 'navy-dark': string; 'navy-light': string
  blue: string; 'blue-light': string; 'blue-border': string
  lavender: string; 'lavender-soft': string; 'lavender-faint': string
}

export const DASHBOARD_THEMES: { id: DashboardThemeId; name: string; palette: Palette }[] = [
  { id: 'lyte', name: 'Lyte', palette: {
    navy: '#1C1B3A', 'navy-dark': '#121130', 'navy-light': '#34336B',
    blue: '#9AB7FD', 'blue-light': '#BFD0FE', 'blue-border': '#D3DEFE',
    lavender: '#E9EAFF', 'lavender-soft': '#F3F4FF', 'lavender-faint': '#FAFAFF' } },
  { id: 'violeta', name: 'Violeta', palette: {
    navy: '#7C3AED', 'navy-dark': '#6D28D9', 'navy-light': '#8B5CF6',
    blue: '#A78BFA', 'blue-light': '#C4B5FD', 'blue-border': '#DDD6FE',
    lavender: '#EDE9FE', 'lavender-soft': '#F5F3FF', 'lavender-faint': '#FCFBFF' } },
  { id: 'oceano', name: 'Océano', palette: {
    navy: '#1D4ED8', 'navy-dark': '#1E40AF', 'navy-light': '#3B82F6',
    blue: '#60A5FA', 'blue-light': '#BFDBFE', 'blue-border': '#DBEAFE',
    lavender: '#E0ECFF', 'lavender-soft': '#EFF6FF', 'lavender-faint': '#F8FBFF' } },
  { id: 'esmeralda', name: 'Esmeralda', palette: {
    navy: '#047857', 'navy-dark': '#065F46', 'navy-light': '#059669',
    blue: '#34D399', 'blue-light': '#A7F3D0', 'blue-border': '#D1FAE5',
    lavender: '#DCFCE7', 'lavender-soft': '#ECFDF5', 'lavender-faint': '#F7FEFB' } },
  { id: 'atardecer', name: 'Atardecer', palette: {
    navy: '#C2410C', 'navy-dark': '#9A3412', 'navy-light': '#EA580C',
    blue: '#FB923C', 'blue-light': '#FED7AA', 'blue-border': '#FFEDD5',
    lavender: '#FFEDD5', 'lavender-soft': '#FFF7ED', 'lavender-faint': '#FFFBF5' } },
  { id: 'rosa', name: 'Rosa', palette: {
    navy: '#BE185D', 'navy-dark': '#9D174D', 'navy-light': '#DB2777',
    blue: '#F472B6', 'blue-light': '#FBCFE8', 'blue-border': '#FCE7F3',
    lavender: '#FCE7F3', 'lavender-soft': '#FDF2F8', 'lavender-faint': '#FFF8FB' } },
  { id: 'grafito', name: 'Grafito', palette: {
    navy: '#0F172A', 'navy-dark': '#020617', 'navy-light': '#334155',
    blue: '#94A3B8', 'blue-light': '#CBD5E1', 'blue-border': '#E2E8F0',
    lavender: '#E2E8F0', 'lavender-soft': '#F1F5F9', 'lavender-faint': '#F8FAFC' } },
]

const STORAGE_KEY = 'lyte-dashboard-theme'
const isThemeId = (v: unknown): v is DashboardThemeId => DASHBOARD_THEMES.some(t => t.id === v)

function applyTheme(id: DashboardThemeId) {
  const theme = DASHBOARD_THEMES.find(t => t.id === id) ?? DASHBOARD_THEMES[0]
  const root = document.documentElement
  for (const [k, v] of Object.entries(theme.palette)) root.style.setProperty(`--lyte-${k}`, v)
}
function clearTheme() {
  const root = document.documentElement
  for (const k of Object.keys(DASHBOARD_THEMES[0].palette)) root.style.removeProperty(`--lyte-${k}`)
}

const Ctx = createContext<{ theme: DashboardThemeId; setTheme: (id: DashboardThemeId) => void }>({
  theme: 'lyte', setTheme: () => {},
})

// Applies the user's chosen theme while the dashboard is mounted (and
// removes it on the way out, so the landing/login keep the brand colors).
// The choice is saved on the user's account so it follows them across
// devices; a local copy makes it apply instantly on load.
export function DashboardThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<DashboardThemeId>(() => {
    if (typeof window === 'undefined') return 'lyte'
    try { const v = localStorage.getItem(STORAGE_KEY); if (isThemeId(v)) return v } catch {}
    return 'lyte'
  })

  useLayoutEffect(() => { applyTheme(theme) }, [theme])
  useLayoutEffect(() => () => clearTheme(), [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const saved = data.user?.user_metadata?.dashboardTheme
      if (isThemeId(saved)) {
        setThemeState(saved)
        try { localStorage.setItem(STORAGE_KEY, saved) } catch {}
      }
    })
  }, [])

  function setTheme(id: DashboardThemeId) {
    setThemeState(id)
    try { localStorage.setItem(STORAGE_KEY, id) } catch {}
    supabase.auth.updateUser({ data: { dashboardTheme: id } })
  }

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>
}

export function useDashboardTheme() {
  return useContext(Ctx)
}
