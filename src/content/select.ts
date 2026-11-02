import type { Color, PieceKind } from '../engine'
import type { GameEvent } from '../engine/events'
import { MAX_CINEMATIC_MS } from './types'
import { CINE_EVENTS } from './types'
import type { Cinematic, CinematicMatch, CineEvent, GifFile, GifKey, KindMatch, MemeEntry, MemeKey } from './types'
import { MOMENTS } from '../engine/moments'

export interface CaptureContext {
  attacker: PieceKind
  victim: PieceKind
  attackerColor: Color
  victimColor: Color
  variants: readonly string[]
  /** Defaults to 'capture'. */
  event?: CineEvent
  enPassant?: boolean
}

const isWild = (m: KindMatch | undefined) => m === undefined || m === '*'
const kindHits = (m: KindMatch, k: PieceKind) => (Array.isArray(m) ? m.includes(k) : m === k)

/** -1 = no match. Higher = more specific. attacker +4, victim +2, variant +1. */
export function scoreMatch(match: CinematicMatch, ctx: CaptureContext): number {
  let score = 0
  if ((match.event ?? 'capture') !== (ctx.event ?? 'capture')) return -1
  if (match.enPassant !== undefined) {
    if (match.enPassant !== !!ctx.enPassant) return -1
    if (match.enPassant) score += 7 // beats even attacker+victim matches (6): en passant is rare and deserves its own gag
  }
  if (!isWild(match.attacker)) {
    if (!kindHits(match.attacker!, ctx.attacker)) return -1
    score += 4
  }
  if (!isWild(match.victim)) {
    if (!kindHits(match.victim!, ctx.victim)) return -1
    score += 2
  }
  if (match.attackerColor) {
    if (match.attackerColor !== ctx.attackerColor) return -1
    score += 0.25 // colour-specific entries beat generic ones
  }
  if (match.victimColor) {
    if (match.victimColor !== ctx.victimColor) return -1
    score += 0.25
  }
  const v = match.variant
  if (v !== undefined && v !== '*') {
    const wanted = Array.isArray(v) ? v : [v]
    if (!wanted.some((id) => ctx.variants.includes(id))) return -1
    score += 1
  }
  return score
}

function weightedPick<T extends { weight?: number }>(items: T[], rand: () => number): T | undefined {
  if (!items.length) return undefined
  const total = items.reduce((n, i) => n + (i.weight ?? 1), 0)
  let r = rand() * total
  for (const item of items) {
    r -= item.weight ?? 1
    if (r < 0) return item
  }
  return items[items.length - 1]
}

/** Most specific tier wins; inside the tier, weighted random. Wildcard entries are the fallback. */
export function pickCinematic(list: readonly Cinematic[], ctx: CaptureContext, rand: () => number = Math.random): Cinematic | undefined {
  let best = -1
  let tier: Cinematic[] = []
  for (const c of list) {
    const s = scoreMatch(c.match, ctx)
    if (s < 0) continue
    if (s > best) {
      best = s
      tier = [c]
    } else if (s === best) tier.push(c)
  }
  return weightedPick(tier, rand)
}

/** The meme key an event stands for: its moment id for moment events, otherwise its type. */
export const memeKeyOf = (e: GameEvent): MemeKey => (e.type === 'moment' ? e.moment : e.type)

export function pickMeme(list: readonly MemeEntry[], key: MemeKey, rand: () => number = Math.random): MemeEntry | undefined {
  const hits = list.filter((m) => (Array.isArray(m.on) ? m.on.includes(key) : m.on === key))
  return weightedPick(hits, rand)
}

/**
 * One move can fire several events (capture, check, a hung queen...). Memes react to the single
 * most important one: the highest-priority key that has GIFs configured or a local meme.
 */
export function pickMemeKey(
  events: readonly GameEvent[],
  gifs: GifFile | null,
  local: readonly MemeEntry[],
  /** False when online GIFs are off or unavailable: then only keys with a local meme count. */
  gifsUsable = true,
): { key: MemeKey; cfg?: GifKey } | null {
  let best: { key: MemeKey; cfg?: GifKey; prio: number } | null = null
  for (const e of events) {
    const key = memeKeyOf(e)
    const cfg = gifs?.keys[key]
    const hasLocal = local.some((m) => (Array.isArray(m.on) ? m.on.includes(key) : m.on === key))
    if (!(cfg && gifsUsable) && !hasLocal) continue
    const prio = cfg?.priority ?? 0
    if (!best || prio > best.prio) best = { key, cfg, prio }
  }
  return best && { key: best.key, cfg: best.cfg }
}

const MEME_KEYS = new Set<string>([...MOMENTS, 'move', 'capture', 'castling', 'promotion', 'check', 'checkmate', 'stalemate', 'duckPlaced', 'draw', 'gameOver', 'blunder', 'moment'])

/** Checks gifs.json; bad keys are dropped and reported instead of breaking the game. */
export function validateGifFile(raw: unknown): { file: GifFile; problems: string[] } {
  const problems: string[] = []
  const r = raw as Partial<GifFile> | null
  if (!r || r.version !== 1 || typeof r.keys !== 'object' || r.keys === null) {
    return { file: { version: 1, keys: {} }, problems: ['gifs.json: expected {version:1, keys:{...}}'] }
  }
  const keys: GifFile['keys'] = {}
  for (const [k, v] of Object.entries(r.keys)) {
    if (!MEME_KEYS.has(k)) { problems.push(`gifs.json: unknown key "${k}"`); continue }
    if (!v || !Array.isArray(v.queries) || !v.queries.length || v.queries.some((q) => typeof q !== 'string' || !q.trim())) { problems.push(`gifs.json: "${k}" needs at least one search phrase`); continue }
    if (typeof v.priority !== 'number') { problems.push(`gifs.json: "${k}" needs a numeric priority`); continue }
    if (v.chance !== undefined && !(v.chance >= 0 && v.chance <= 1)) { problems.push(`gifs.json: "${k}" chance outside 0..1`); continue }
    keys[k as MemeKey] = v
  }
  const rating = r.rating && ['g', 'pg', 'pg-13'].includes(r.rating) ? r.rating : 'g'
  if (r.rating && rating !== r.rating) problems.push(`gifs.json: unsupported rating "${r.rating}", using g`)
  return { file: { version: 1, rating, keys, blocked: Array.isArray(r.blocked) ? r.blocked.filter((b) => typeof b === 'string') : [] }, problems }
}

export function pickText(text: string | string[], rand: () => number = Math.random): string {
  return Array.isArray(text) ? text[Math.floor(rand() * text.length)] ?? '' : text
}

const STEP_FIELDS: Record<string, string[]> = {
  spawn: ['id', 'sprite', 'anchor'],
  move: ['target', 'to', 'ms'],
  rotate: ['target', 'deg', 'ms'],
  scale: ['target', 'to', 'ms'],
  caption: ['text', 'ms'],
  shake: ['target', 'ms'],
  fade: ['target', 'to', 'ms'],
  pose: ['target', 'pose'],
  sound: ['sfx'],
  despawn: ['target'],
}
const ANCHOR = /^(attacker|victim|from|to|between|[a-h][1-8]|aim:-?\d+(\.\d+)?)(\+-?\d+(\.\d+)?,-?\d+(\.\d+)?)?$/

/** Human-readable problems with one cinematic (empty array = fine). */
export function checkCinematic(c: Cinematic): string[] {
  const out: string[] = []
  if (!Array.isArray(c.steps)) return [`"${c.id}" needs steps[]`]
  const spawned = new Set<string>()
  const ev = c.match?.event
  if (ev !== undefined && !CINE_EVENTS.includes(ev)) out.push(`"${c.id}" has unknown event "${String(ev)}"`)
  if (c.chance !== undefined && !(c.chance >= 0 && c.chance <= 1)) out.push(`"${c.id}" has a chance outside 0..1`)
  for (const [i, step] of c.steps.entries()) {
    const at = `"${c.id}" step ${i + 1}`
    const st = step as unknown as Record<string, unknown>
    if (typeof st.at !== 'number' || st.at < 0) out.push(`${at} has a bad "at"`)
    const required = STEP_FIELDS[String(st.do)]
    if (!required) {
      out.push(`${at} has unknown "do": ${String(st.do)}`)
      continue
    }
    for (const field of required) if (st[field] === undefined) out.push(`${at} (${String(st.do)}) is missing "${field}"`)
    if (st.do === 'spawn' && typeof st.id === 'string') spawned.add(st.id)
    for (const key of ['anchor', 'from', 'to']) {
      const v = st[key]
      if (typeof v === 'string' && st.do !== 'scale' && st.do !== 'fade' && !ANCHOR.test(v)) out.push(`${at} has an unknown anchor "${v}"`)
    }
    const t = st.target
    if (typeof t === 'string' && t !== 'attacker' && t !== 'victim' && !spawned.has(t)) out.push(`${at} targets "${t}", which is never spawned before it`)
  }
  return out
}

/** Valid cinematics plus a list of problems. One bad entry never takes the others down. */
export function validateCinematicsReport(raw: unknown): { items: Cinematic[]; problems: string[] } {
  const file = raw as { version?: number; cinematics?: Cinematic[] }
  if (!file || file.version !== 1 || !Array.isArray(file.cinematics)) throw new Error('cinematics.json: expected {version:1, cinematics:[...]}')
  const ids = new Set<string>()
  const items: Cinematic[] = []
  const problems: string[] = []
  for (const c of file.cinematics) {
    if (!c || !c.id || ids.has(c.id)) {
      problems.push(`missing or duplicate id "${c?.id}"`)
      continue
    }
    ids.add(c.id)
    const bad = checkCinematic(c)
    if (bad.length) {
      problems.push(...bad)
      continue
    }
    items.push({ ...c, match: c.match ?? {}, duration: Math.min(Math.max(c.duration ?? 1500, 300), MAX_CINEMATIC_MS) })
  }
  return { items, problems }
}

/** Convenience wrapper: returns the valid cinematics and logs problems. Throws only for a broken file. */
export function validateCinematics(raw: unknown): Cinematic[] {
  const { items, problems } = validateCinematicsReport(raw)
  for (const p of problems) console.warn('cinematics.json:', p)
  return items
}

export function clampMemeMs(ms: number | undefined): number {
  return Math.min(Math.max(ms ?? 3000, 2000), 4000)
}
