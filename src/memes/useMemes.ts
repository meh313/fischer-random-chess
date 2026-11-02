import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameEvent } from '../engine'
import { clampMemeMs, pickMeme, pickMemeKey, pickText } from '../content/select'
import type { GifFile, MemeEntry } from '../content/types'
import { asset } from '../content/loaders'
import { playSfx } from '../audio/sfx'
import type { Settings } from '../state/settings'
import { giphyKey, preload, searchGif, type GifHit } from './giphy'

export interface ActiveMeme {
  key: number
  ms: number
  src: string
  video: boolean
  caption?: string
  placeholder?: boolean
  /** Set when the media came from GIPHY (drives the attribution badge). */
  gif?: GifHit
}

/** `until` is the latest time it may still start; a meme for a moment long gone is dropped. */
type Item = Omit<ActiveMeme, 'key'> & { sound?: string; until: number }

const MAX_QUEUE = 3
const VIDEO = /\.(mp4|webm|ogv)$/i
const GIF_MS = 3000
/** A GIF that takes longer than this to find and load is dropped: the game has moved on. */
const GIF_DEADLINE_MS = 2500
/** How long a queued meme stays relevant; big moments (priority >= BIG) may wait out a cooldown. */
const STALE_MS = 4000
const BIG = 90
const BIG_STALE_MS = 15000
/** After a GIPHY error (rate limit, offline) use local memes only for a while. */
const BACKOFF_MS = 60000

const fromLocal = (e: MemeEntry, until: number, caption?: string): Item => ({
  until,
  ms: clampMemeMs(e.ms),
  src: asset(`memes/${e.media}`),
  video: VIDEO.test(e.media),
  caption: e.caption ?? caption,
  placeholder: e.placeholder,
  sound: e.sound,
})

/**
 * Meme queue. All events of one move are looked at together and only the most important
 * key (a hung queen beats a plain capture) can show a meme. Online GIFs come from GIPHY
 * when enabled and a key is configured; local memes.json entries are the fallback.
 */
export function useMemes(memes: readonly MemeEntry[], gifs: GifFile | null, settings: Settings) {
  const [active, setActive] = useState<ActiveMeme | null>(null)
  const queue = useRef<Item[]>([])
  const lastEnd = useRef(0)
  const key = useRef(0)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const memesRef = useRef(memes)
  memesRef.current = memes
  const gifsRef = useRef(gifs)
  gifsRef.current = gifs
  const timer = useRef<number>(0)
  const showing = useRef(false)
  const batch = useRef<GameEvent[]>([])
  /** Bumped when memes are switched off so late GIF lookups are discarded. */
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
      const { sound, until: _until, ...shown } = next
      showing.current = true
      setActive({ key: ++key.current, ...shown })
      if (sound) void playSfx(sound)
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
    async (events: GameEvent[], queries: string[], caption: string | undefined, until: number, gen: number) => {
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
        enqueue({ ms: GIF_MS, src: hit.src, video: false, caption, gif: hit, sound: 'meme', until })
      } catch (err) {
        if ((err as Error).message.startsWith('GIPHY HTTP') || (err as Error).name === 'TypeError') backoffUntil.current = Date.now() + BACKOFF_MS
        if (gen !== generation.current) return
        // Fall back to the best key of the same move that has a local meme.
        const pick = pickMemeKey(events, null, memesRef.current)
        const local = pick && pickMeme(memesRef.current, pick.key)
        if (local) enqueue(fromLocal(local, until, caption))
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
    const gifFile = gifsRef.current
    const gifsUsable = s.gifs && !!giphyKey() && Date.now() >= backoffUntil.current
    const pick = pickMemeKey(events, gifFile, memesRef.current, gifsUsable)
    if (!pick) return
    const big = (pick.cfg?.priority ?? 0) >= BIG
    // Small moments never pile up: skip them while a meme is showing, queued, loading or cooling down.
    const busy = showing.current || queue.current.length > 0 || inFlight.current > 0 || Date.now() < lastEnd.current + s.memeCooldownSec * 1000
    if (busy && !big) return
    const odds = (pick.cfg?.chance ?? 1) * s.memeChance
    if (Math.random() >= odds) return
    if (queue.current.length + inFlight.current >= MAX_QUEUE) return
    const caption = pick.cfg?.captions?.length ? pickText(pick.cfg.captions) : undefined
    const until = Date.now() + (big ? BIG_STALE_MS : STALE_MS)
    if (gifsUsable && pick.cfg) {
      void fetchGif(events, pick.cfg.queries, caption, until, generation.current)
      return
    }
    const local = pickMeme(memesRef.current, pick.key)
    if (local) enqueue(fromLocal(local, until, caption))
  }, [enqueue, fetchGif])

  const trigger = useCallback(
    (event: GameEvent) => {
      // A move delivers its events in one synchronous burst; decide once for the whole burst.
      if (!batch.current.length) queueMicrotask(decide)
      batch.current.push(event)
    },
    [decide],
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
