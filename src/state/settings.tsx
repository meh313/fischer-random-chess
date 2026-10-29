import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export interface Settings {
  cinematics: boolean
  /** Chance (0..1) that a capture plays a cinematic. */
  cinematicChance: number
  memes: boolean
  /** Chance (0..1) that an eligible event shows a meme. */
  memeChance: number
  /** Minimum seconds between memes. */
  memeCooldownSec: number
  sound: boolean
  volume: number
  pieceSet: string
  names: { w: string; b: string }
  /** "minutes+increment" or "inf". */
  timeControl: string
  /** Who you play against. */
  opponent: 'human' | 'easy' | 'medium' | 'hard'
  /** Your color against the computer. */
  playAs: 'w' | 'b'
  /** A gun hand aims at the mover's attacked, undefended pieces. */
  aimMode: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  cinematics: true,
  cinematicChance: 1,
  memes: true,
  memeChance: 0.6,
  memeCooldownSec: 10,
  sound: true,
  volume: 0.6,
  pieceSet: 'chad',
  names: { w: 'Player 1', b: 'Player 2' },
  timeControl: '10+0',
  opponent: 'human',
  playAs: 'w',
  aimMode: false,
}

const KEY = 'chass.settings.v1'

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed, names: { ...DEFAULT_SETTINGS.names, ...parsed.names } }
  } catch {
    return DEFAULT_SETTINGS
  }
}

interface Ctx {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  reset: () => void
}

const SettingsContext = createContext<Ctx | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load)

  const persist = (next: Settings) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* private mode or blocked storage: keep working in memory */
    }
  }
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      persist(next)
      return next
    })
  }, [])
  const reset = useCallback(() => {
    persist(DEFAULT_SETTINGS)
    setSettings(DEFAULT_SETTINGS)
  }, [])

  const value = useMemo(() => ({ settings, update, reset }), [settings, update, reset])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings outside SettingsProvider')
  return ctx
}

export function parseTimeControl(tc: string): { initialMs: number; incrementMs: number } | null {
  if (tc === 'inf') return null
  const [m, inc = '0'] = tc.split('+')
  const minutes = Number(m)
  if (!Number.isFinite(minutes) || minutes <= 0) return null
  return { initialMs: Math.round(minutes * 60_000), incrementMs: Math.round(Number(inc) * 1000) || 0 }
}

export const TIME_CONTROLS: { id: string; label: string }[] = [
  { id: '1+0', label: '1 min' },
  { id: '3+2', label: '3 + 2' },
  { id: '5+0', label: '5 min' },
  { id: '10+0', label: '10 min' },
  { id: '15+10', label: '15 + 10' },
  { id: 'inf', label: 'No clock' },
]
