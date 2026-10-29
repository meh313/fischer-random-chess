import type { Color, PieceKind } from '../engine'
import type { GameEvent } from '../engine/events'
import { MAX_CINEMATIC_MS } from './types'
import type { Cinematic, CinematicMatch, KindMatch, MemeEntry } from './types'

export interface CaptureContext {
  attacker: PieceKind
  victim: PieceKind
  attackerColor: Color
  victimColor: Color
  variants: readonly string[]
}

const isWild = (m: KindMatch | undefined) => m === undefined || m === '*'
const kindHits = (m: KindMatch, k: PieceKind) => (Array.isArray(m) ? m.includes(k) : m === k)

/** -1 = no match. Higher = more specific. attacker +4, victim +2, variant +1. */
export function scoreMatch(match: CinematicMatch, ctx: CaptureContext): number {
  let score = 0
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

export function pickMeme(list: readonly MemeEntry[], event: GameEvent, rand: () => number = Math.random): MemeEntry | undefined {
  const hits = list.filter((m) => (Array.isArray(m.on) ? m.on.includes(event.type) : m.on === event.type))
  return weightedPick(hits, rand)
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
const ANCHOR = /^(attacker|victim|from|to|between|[a-h][1-8]|aim:-?\d+(\.\d+)?)$/

/** Human-readable problems with one cinematic (empty array = fine). */
export function checkCinematic(c: Cinematic): string[] {
  const out: string[] = []
  if (!Array.isArray(c.steps)) return [`"${c.id}" needs steps[]`]
  const spawned = new Set<string>()
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
