import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameEvent, Square } from '../engine'
import { clampFlashMs, pickMeme, pickMemeKey, pickText, queriesFor } from '../content/select'
import type { GifFile, MemeEntry } from '../content/types'
import { asset } from '../content/loaders'
import type { Settings } from '../state/settings'
import { giphyKey, preload, searchGif, type GifHit } from './giphy'

/** One reaction flash on a board square. No text: just the clip, played once. */
export interface ActiveMeme {
  key: number
  /** Longest it may stay up; a clip that ends sooner closes itself. */
  ms: number
  src: string
  video: boolean
  square: Square
  /** Set when the media came from GIPHY (attribution). */
  gif?: GifHit
}

/** `until` is the latest time it may still start; a flash for a moment long gone is dropped. */
type Item = Omit<ActiveMeme, 'key'> & { until: number }

const MAX_QUEUE = 2
const VIDEO = /\.(mp4|webm|ogv)$/i
/** A clip plays once, but never longer than this. */
const FLASH_MS = 2200
/** A GIF that takes longer than this to find and load is dropped: the game has moved on. */
const GIF_DEADLINE_MS = 2000
const STALE_MS = 3000
/** Big moments (priority >= BIG) may wait out a cooldown. */
const BIG = 90
const BIG_STALE_MS = 12000
/** After a GIPHY error (rate limit, offline) use local memes only for a while. */
const BACKOFF_MS = 60000

const fromLocal = (e: MemeEntry, square: Square, until: number): Item => ({
  ms: clampFlashMs(e.ms),
  src: asset(`memes/${e.media}`),
  video: VIDEO.test(e.media),
  square,
  until,
})

/**
 * Reaction flashes. All events of one move are looked at together and only the most important
 * key (a hung queen beats a plain capture) can flash, on the square it is about. Online GIFs come
 * from GIPHY when enabled; local memes.json entries are the fallback (placeholders never flash).
 */
export function useMemes(memes: readonly MemeEntry[], gifs: GifFile | null, settings: Settings) {
  const [active, setActive] = useState<ActiveMeme | null>(null)
  const queue = useRef<Item[]>([])
  const lastEnd = useRef(0)
  const key = useRef(0)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const localRef = useRef<MemeEntry[]>([])
  localRef.current = memes.filter((m) => !m.placeholder)
  const gifsRef = useRef(gifs)
  gifsRef.current = gifs
  const timer = useRef<number>(0)
  const showing = useRef(false)
  const batch = useRef<GameEvent[]>([])
  /** Bumped on reset so late GIF lookups are discarded. */
  const generation = useRef(0)
  const inFlight = useRef(0)
  const backoffUntil = useRef(0)

  const pump = useCallback(() => {
    const s = settingsRef.current
    if (!s.memes || timer.current) return
    let next = queue.current.shift()
    while (next && next.until < Date.now()) next = queue.current.shift()
    if (!next) return
    const wait = lastEnd.current + s.memeCooldownSec * 1000 - Date.now()
    const start = () => {
      const { until: _until, ...shown } = next
      showing.current = true
      setActive({ key: ++key.current, ...shown })
      timer.current = window.setTimeout(() => {
        timer.current = 0
        showing.current = false
        lastEnd.current = Date.now()
        setActive(null)
        pump()
      }, next.ms)
    }
    if (wait > 0) {
      timer.current = window.setTimeout(() => {
        timer.current = 0
        start()
      }, wait)
    } else start()
  }, [])

  const enqueue = useCallback(
    (item: Item | null) => {
      if (!item || queue.current.length >= MAX_QUEUE) return
      queue.current.push(item)
      pump()
    },
    [pump],
  )

  const fetchGif = useCallback(
    async (events: GameEvent[], queries: string[], square: Square, until: number, gen: number) => {
      const file = gifsRef.current
      const started = Date.now()
      const ctrl = new AbortController()
      const abort = window.setTimeout(() => ctrl.abort(), GIF_DEADLINE_MS)
      inFlight.current++
      try {
        const hit = await searchGif(pickText(queries), { key: giphyKey(), rating: file?.rating ?? 'g', blocked: file?.blocked, signal: ctrl.signal })
        if (!hit) throw new Error('no GIF found')
        await preload(hit.src, Math.max(200, GIF_DEADLINE_MS - (Date.now() - started)))
        if (gen !== generation.current) return
        enqueue({ ms: FLASH_MS, src: hit.src, video: true, square, gif: hit, until })
      } catch (err) {
        if ((err as Error).message.startsWith('GIPHY HTTP') || (err as Error).name === 'TypeError') backoffUntil.current = Date.now() + BACKOFF_MS
        if (gen !== generation.current) return
        // Fall back to the best key of the same move that has a local meme.
        const pick = pickMemeKey(events, null, localRef.current)
        const local = pick && pickMeme(localRef.current, pick.key)
        if (local) enqueue(fromLocal(local, square, until))
      } finally {
        clearTimeout(abort)
        inFlight.current--
      }
    },
    [enqueue],
  )

  const decide = useCallback(() => {
    const events = batch.current
    batch.current = []
    const s = settingsRef.current
    if (!s.memes) return
    const gifsUsable = s.gifs && !!giphyKey() && Date.now() >= backoffUntil.current
    const pick = pickMemeKey(events, gifsRef.current, localRef.current, gifsUsable)
    if (!pick || pick.ctx.square === undefined) return
    const big = (pick.cfg?.priority ?? 0) >= BIG
    // Small moments never pile up: skip them while a flash is showing, queued, loading or cooling down.
    const busy = showing.current || queue.current.length > 0 || inFlight.current > 0 || Date.now() < lastEnd.current + s.memeCooldownSec * 1000
    if (busy && !big) return
    if (Math.random() >= (pick.cfg?.chance ?? 1) * s.memeChance) return
    if (queue.current.length + inFlight.current >= MAX_QUEUE) return
    const until = Date.now() + (big ? BIG_STALE_MS : STALE_MS)
    if (gifsUsable && pick.cfg) {
      void fetchGif(events, queriesFor(pick.cfg, pick.ctx), pick.ctx.square, until, generation.current)
      return
    }
    const local = pickMeme(localRef.current, pick.key)
    if (local) enqueue(fromLocal(local, pick.ctx.square, until))
  }, [enqueue, fetchGif])

  const trigger = useCallback(
    (event: GameEvent) => {
      // A move delivers its events in one synchronous burst; decide once for the whole burst.
      if (!batch.current.length) queueMicrotask(decide)
      batch.current.push(event)
    },
    [decide],
  )

  /** Closes the current flash early (the clip ended, or the player clicked). */
  const dismiss = useCallback(() => {
    if (!showing.current) return // nothing visible: leave queued flashes and the cooldown alone
    showing.current = false
    clearTimeout(timer.current)
    timer.current = 0
    lastEnd.current = Date.now()
    setActive(null)
    pump()
  }, [pump])

  /** Drops everything pending or showing, e.g. for a new game. Late GIF lookups are discarded too. */
  const reset = useCallback(() => {
    generation.current++
    batch.current = []
    queue.current = []
    clearTimeout(timer.current)
    timer.current = 0
    showing.current = false
    setActive(null)
  }, [])

  useEffect(() => {
    if (!settings.memes) reset()
  }, [settings.memes, reset])

  useEffect(() => () => clearTimeout(timer.current), [])

  return { active, trigger, dismiss, reset }
}
