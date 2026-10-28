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
  if (match.attackerColor && match.attackerColor !== ctx.attackerColor) return -1
  if (match.victimColor && match.victimColor !== ctx.victimColor) return -1
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

/** Throws a readable error for malformed content; clamps durations. */
export function validateCinematics(raw: unknown): Cinematic[] {
  const file = raw as { version?: number; cinematics?: Cinematic[] }
  if (!file || file.version !== 1 || !Array.isArray(file.cinematics)) throw new Error('cinematics.json: expected {version:1, cinematics:[...]}')
  const ids = new Set<string>()
  return file.cinematics.map((c) => {
    if (!c.id || ids.has(c.id)) throw new Error(`cinematics.json: missing or duplicate id "${c.id}"`)
    ids.add(c.id)
    if (!Array.isArray(c.steps)) throw new Error(`cinematics.json: "${c.id}" needs steps[]`)
    for (const s of c.steps) {
      if (typeof s.at !== 'number' || s.at < 0) throw new Error(`cinematics.json: "${c.id}" has a step with bad "at"`)
    }
    return { ...c, match: c.match ?? {}, duration: Math.min(Math.max(c.duration ?? 1500, 300), MAX_CINEMATIC_MS) }
  })
}

export function clampMemeMs(ms: number | undefined): number {
  return Math.min(Math.max(ms ?? 3000, 2000), 4000)
}
