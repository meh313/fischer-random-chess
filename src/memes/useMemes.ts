import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameEvent } from '../engine'
import { clampMemeMs, pickMeme } from '../content/select'
import type { MemeEntry } from '../content/types'
import { playSfx } from '../audio/sfx'
import type { Settings } from '../state/settings'

export interface ActiveMeme {
  key: number
  entry: MemeEntry
  ms: number
}

const MAX_QUEUE = 3

/**
 * Meme queue: events enqueue (subject to chance), one meme shows at a time for 2-4 s,
 * and a cooldown keeps them rare. Everything is driven by memes.json.
 */
export function useMemes(memes: readonly MemeEntry[], settings: Settings) {
  const [active, setActive] = useState<ActiveMeme | null>(null)
  const queue = useRef<MemeEntry[]>([])
  const lastEnd = useRef(0)
  const key = useRef(0)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const memesRef = useRef(memes)
  memesRef.current = memes
  const timer = useRef<number>(0)
  const showing = useRef(false)

  const pump = useCallback(() => {
    const s = settingsRef.current
    if (!s.memes || timer.current) return
    const next = queue.current.shift()
    if (!next) return
    const wait = lastEnd.current + s.memeCooldownSec * 1000 - Date.now()
    const start = () => {
      const ms = clampMemeMs(next.ms)
      showing.current = true
      setActive({ key: ++key.current, entry: next, ms })
      if (next.sound) void playSfx(next.sound)
      timer.current = window.setTimeout(() => {
        timer.current = 0
        showing.current = false
        lastEnd.current = Date.now()
        setActive(null)
        pump()
      }, ms)
    }
    if (wait > 0) {
      timer.current = window.setTimeout(() => {
        timer.current = 0
        start()
      }, wait)
    } else start()
  }, [])

  const trigger = useCallback(
    (event: GameEvent) => {
      const s = settingsRef.current
      if (!s.memes || Math.random() > s.memeChance) return
      const entry = pickMeme(memesRef.current, event)
      if (!entry || queue.current.length >= MAX_QUEUE) return
      queue.current.push(entry)
      pump()
    },
    [pump],
  )

  const dismiss = useCallback(() => {
    if (!showing.current) return // nothing visible: leave queued memes and the cooldown alone
    showing.current = false
    clearTimeout(timer.current)
    timer.current = 0
    lastEnd.current = Date.now()
    setActive(null)
    pump()
  }, [pump])

  useEffect(() => {
    if (!settings.memes) {
      queue.current = []
      clearTimeout(timer.current)
      timer.current = 0
      showing.current = false
      setActive(null)
    }
  }, [settings.memes])

  useEffect(() => () => clearTimeout(timer.current), [])

  return { active, trigger, dismiss }
}
