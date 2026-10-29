import { fileOf, opposite, rankOf } from '../engine/board'
import { positionKey } from '../engine/game'
import { applyMove, hasNoCheck, inCheck, isTwoPhase, legalMoves, pseudoMoves } from '../engine/rules'
import type { Move, PieceKind, Square, State } from '../engine/types'
import type { Variant } from '../engine/variant'

/**
 * Small license-free AI: iterative-deepening negamax with alpha-beta, quiescence on captures,
 * MVV-LVA ordering and a time limit. Works for every variant because it only uses the engine's
 * public rules (legalMoves/applyMove). Duck chess searches a few relevant duck squares per turn.
 * It is a fun opponent, not a strong engine.
 */

export type AiLevel = 'easy' | 'medium' | 'hard'

export interface AiOptions {
  maxDepth: number
  timeMs: number
  /** Random jitter (centipawns) added to root scores so play varies. */
  noise: number
  rng?: () => number
  /** Positions already played in the real game (key -> count). Used to dodge or steer into repetition draws. */
  seen?: Map<string, number>
}

export const LEVELS: Record<AiLevel, AiOptions> = {
  easy: { maxDepth: 2, timeMs: 300, noise: 120 },
  medium: { maxDepth: 4, timeMs: 1200, noise: 20 },
  hard: { maxDepth: 8, timeMs: 3500, noise: 4 },
}

export type AiAction = { kind: 'move'; move: Move; duck?: Square; score: number; depth: number } | { kind: 'duck'; square: Square }

const MATE = 100_000
const VALUE: Record<PieceKind, number> = { p: 100, n: 320, b: 330, d: 450, r: 500, q: 900, k: 0 }
const DUCK_CANDIDATES = 5
const ABORT = Symbol('abort')

interface Ctx {
  vs: readonly Variant[]
  noCheck: boolean
  twoPhase: boolean
  deadline: number
  nodes: number
}

// ------------------------------------------------------------------ evaluation

/** Score from the side to move's point of view, in centipawns. */
export function evaluate(s: State, noCheck = false): number {
  let score = 0
  let nonPawn = 0
  let matW = 0
  let matB = 0
  for (let sq = 0; sq < 64; sq++) {
    const p = s.board[sq]
    if (!p || p.kind === 'k') continue
    const f = fileOf(sq)
    const r = rankOf(sq)
    const dist = Math.max(Math.abs(f - 3.5), Math.abs(r - 3.5)) // 0.5 (center) .. 3.5 (corner)
    const center = (3.5 - dist) * 10
    let v = VALUE[p.kind]
    if (p.color === 'w') matW += v
    else matB += v
    if (p.kind !== 'p') nonPawn += v
    switch (p.kind) {
      case 'p':
        v += (p.color === 'w' ? r - 1 : 6 - r) * 7 + (f === 3 || f === 4 ? center * 0.5 : 0)
        break
      case 'n':
      case 'b':
      case 'd':
        v += center
        break
      case 'q':
        v += center * 0.3
        break
      case 'r':
        v += (p.color === 'w' ? r === 6 : r === 1) ? 12 : 0
        break
    }
    score += p.color === 'w' ? v : -v
  }

  // Kings: hide them while queens are around, centralize them in the endgame.
  const endgame = nonPawn <= 2400
  const kingDist = (sq: number) => Math.max(Math.abs(fileOf(sq) - 3.5), Math.abs(rankOf(sq) - 3.5))
  if (!noCheck) {
    for (const c of ['w', 'b'] as const) {
      const k = s.kings[c]
      if (k < 0) continue
      const t = endgame ? (3.5 - kingDist(k)) * 25 : -(3.5 - kingDist(k)) * 8
      score += c === 'w' ? t : -t
    }
    // Mop-up: the side that is clearly ahead drives the enemy king to the edge and brings its own king close.
    const diff = matW - matB
    if (endgame && Math.abs(diff) >= 250 && s.kings.w >= 0 && s.kings.b >= 0) {
      const winner = diff > 0 ? 'w' : 'b'
      const lose = s.kings[opposite(winner)]
      const win = s.kings[winner]
      const manhattan = Math.abs(fileOf(lose) - fileOf(win)) + Math.abs(rankOf(lose) - rankOf(win))
      const mop = kingDist(lose) * 25 + (14 - manhattan) * 8
      score += winner === 'w' ? mop : -mop
    }
  }
  return s.turn === 'w' ? score : -score
}

const orderScore = (m: Move): number =>
  (m.capture ? 10 * VALUE[m.capture.kind] - VALUE[m.piece.kind] + 10_000 : 0) + (m.promotion ? VALUE[m.promotion] : 0)

function ordered(moves: Move[]): Move[] {
  return moves.sort((a, b) => orderScore(b) - orderScore(a))
}

const tick = (ctx: Ctx) => {
  if ((++ctx.nodes & 1023) === 0 && performance.now() > ctx.deadline) throw ABORT
}

// ----------------------------------------------------------------------- duck

/** Biggest piece the side to move could capture right now (duck rules: nothing is protected by check). */
function bestCapture(s: State, ctx: Ctx): number {
  let best = 0
  for (const m of pseudoMoves(s, ctx.vs)) if (m.capture) best = Math.max(best, m.capture.kind === 'k' ? MATE / 2 : VALUE[m.capture.kind])
  return best
}

/**
 * A handful of duck squares worth searching: squares that cut the lines of the opponent's
 * capturing sliders, plus one quiet fallback. The duck cannot stop knight, pawn or king captures.
 */
export function duckCandidates(s: State, ctx: Pick<Ctx, 'vs'>): Square[] {
  const free = (sq: Square) => s.board[sq] === null && sq !== s.duck
  const opp = opposite(s.turn)
  const asOpp: State = { ...s, turn: opp, phase: 'move', duck: null }
  const scored = new Map<Square, number>()
  for (const m of pseudoMoves(asOpp, ctx.vs)) {
    if (!m.capture) continue
    const gain = m.capture.kind === 'k' ? MATE / 2 : VALUE[m.capture.kind]
    const df = Math.sign(fileOf(m.to) - fileOf(m.from))
    const dr = Math.sign(rankOf(m.to) - rankOf(m.from))
    const straight = fileOf(m.to) === fileOf(m.from) || rankOf(m.to) === rankOf(m.from) || Math.abs(fileOf(m.to) - fileOf(m.from)) === Math.abs(rankOf(m.to) - rankOf(m.from))
    if (!straight) continue
    let f = fileOf(m.from) + df
    let r = rankOf(m.from) + dr
    while (r * 8 + f !== m.to) {
      const sq = r * 8 + f
      if (free(sq)) scored.set(sq, (scored.get(sq) ?? 0) + gain)
      f += df
      r += dr
    }
  }
  const out = [...scored.entries()].sort((a, b) => b[1] - a[1]).map(([sq]) => sq).slice(0, DUCK_CANDIDATES - 1)
  // Quiet fallback: a free square in front of the opponent's most advanced pawn, else any free square.
  let fallback: Square | null = null
  let bestAdv = -1
  for (let sq = 0; sq < 64; sq++) {
    const p = s.board[sq]
    if (!p || p.color !== opp || p.kind !== 'p') continue
    const adv = opp === 'w' ? rankOf(sq) : 7 - rankOf(sq)
    const ahead = sq + (opp === 'w' ? 8 : -8)
    if (adv > bestAdv && ahead >= 0 && ahead < 64 && free(ahead)) {
      bestAdv = adv
      fallback = ahead
    }
  }
  if (fallback === null) for (let sq = 0; sq < 64 && fallback === null; sq++) if (free(sq)) fallback = sq
  if (fallback !== null && !out.includes(fallback)) out.push(fallback)
  return out
}

const placeDuck = (s: State, sq: Square): State => ({
  ...s,
  duck: sq,
  phase: 'move',
  turn: opposite(s.turn),
  fullmove: s.fullmove + (s.turn === 'b' ? 1 : 0),
})

/** Value (for the mover, who also places the duck) of a position in the duck phase. */
function duckNode(c: State, depth: number, alpha: number, beta: number, ply: number, ctx: Ctx): { score: number; duck?: Square } {
  const mover = c.turn
  if (c.kings[opposite(mover)] < 0) return { score: MATE - ply }
  let best = -Infinity
  let bestDuck: Square | undefined
  for (const sq of duckCandidates(c, ctx)) {
    const score = -negamax(placeDuck(c, sq), depth, -beta, -alpha, ply + 1, ctx)
    if (score > best) {
      best = score
      bestDuck = sq
    }
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best === -Infinity ? { score: evaluate({ ...c, turn: mover }, true) } : { score: best, duck: bestDuck }
}

// --------------------------------------------------------------------- search

function quiesce(s: State, alpha: number, beta: number, ply: number, qdepth: number, ctx: Ctx, pre?: Move[]): number {
  tick(ctx)
  const all = pre ?? legalMoves(s, ctx.vs)
  const checked = !ctx.noCheck && inCheck(s, ctx.vs)
  if (!all.length) return checked ? -(MATE - ply) : 0
  if (checked) {
    // Standing pat is illegal in check: every evasion has to be considered.
    if (qdepth <= 0) return evaluate(s, ctx.noCheck)
    let best = -Infinity
    for (const m of ordered(all)) {
      const score = -quiesce(applyMove(s, m, ctx.vs), -beta, -alpha, ply + 1, qdepth - 1, ctx)
      if (score > best) best = score
      if (best > alpha) alpha = best
      if (alpha >= beta) break
    }
    return best
  }
  const stand = evaluate(s, ctx.noCheck)
  if (qdepth <= 0 || stand >= beta) return stand
  if (stand > alpha) alpha = stand
  for (const m of ordered(all.filter((x) => x.capture || x.promotion))) {
    const score = -quiesce(applyMove(s, m, ctx.vs), -beta, -alpha, ply + 1, qdepth - 1, ctx)
    if (score >= beta) return score
    if (score > alpha) alpha = score
  }
  return alpha
}

function negamax(s: State, depth: number, alpha: number, beta: number, ply: number, ctx: Ctx): number {
  tick(ctx)
  if (s.halfmove >= 100) return 0
  const moves = legalMoves(s, ctx.vs)
  if (!moves.length) {
    if (ctx.noCheck) return MATE - ply // duck: a player with no moves wins
    return inCheck(s, ctx.vs) ? -(MATE - ply) : 0
  }
  if (depth <= 0) {
    if (ctx.twoPhase) return evaluate(s, true) + Math.round(bestCapture(s, ctx) * 0.7)
    return quiesce(s, alpha, beta, ply, 6, ctx, moves)
  }
  let best = -Infinity
  for (const m of ordered(moves)) {
    const child = applyMove(s, m, ctx.vs)
    const score = ctx.twoPhase ? duckNode(child, depth - 1, alpha, beta, ply + 1, ctx).score : -negamax(child, depth - 1, -beta, -alpha, ply + 1, ctx)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

/** Picks the AI's next action. Call it for a piece move (phase 'move') or a duck placement (phase 'duck'). */
export function chooseAction(state: State, vs: readonly Variant[], opts: AiOptions): AiAction {
  const rng = opts.rng ?? Math.random
  const ctx: Ctx = { vs, noCheck: hasNoCheck(vs), twoPhase: isTwoPhase(vs), deadline: performance.now() + opts.timeMs, nodes: 0 }

  if (state.phase === 'duck') {
    const cands = duckCandidates(state, ctx)
    let best = cands[0]!
    let bestScore = -Infinity
    for (const sq of cands) {
      let score: number
      try {
        score = -negamax(placeDuck(state, sq), Math.min(opts.maxDepth - 1, 2), -MATE, MATE, 1, ctx) + (rng() - 0.5) * opts.noise
      } catch (e) {
        if (e !== ABORT) throw e
        break
      }
      if (score > bestScore) {
        bestScore = score
        best = sq
      }
    }
    return { kind: 'duck', square: best }
  }

  const root = ordered(legalMoves(state, vs))
  if (!root.length) throw new Error('No legal moves')
  let best: AiAction = { kind: 'move', move: root[0]!, score: -Infinity, depth: 0 }
  let order = root
  for (let depth = 1; depth <= opts.maxDepth; depth++) {
    const scored: { m: Move; score: number; duck?: Square }[] = []
    let bestSoFar = -Infinity
    try {
      for (const m of order) {
        const child = applyMove(state, m, vs)
        // Moves worse than the best by more than the noise can never be picked, so search them with a narrow window.
        const lower = bestSoFar === -Infinity ? -MATE : Math.max(-MATE, bestSoFar - opts.noise - 25)
        let score: number
        let duck: Square | undefined
        if (ctx.twoPhase) {
          const r = duckNode(child, depth - 1, lower, MATE, 1, ctx)
          score = r.score
          duck = r.duck
        } else {
          score = -negamax(child, depth - 1, -MATE, -lower, 1, ctx)
          if (opts.seen) {
            // A move that repeats a position for the third time is a draw; one that repeats it once is mildly worse.
            const seenTimes = opts.seen.get(positionKey(child, vs)) ?? 0
            if (seenTimes >= 2) score = 0
            else if (seenTimes === 1) score -= 15
          }
        }
        scored.push({ m, score, duck })
        if (score > bestSoFar) bestSoFar = score
        if (score >= MATE - 100) break // forced win found, no need to look further
      }
    } catch (e) {
      if (e !== ABORT) throw e
      break
    }
    scored.sort((a, b) => b.score - a.score)
    const jittered = scored.map((x) => ({ ...x, j: x.score + (rng() - 0.5) * opts.noise }))
    jittered.sort((a, b) => b.j - a.j)
    const top = jittered[0]!
    best = { kind: 'move', move: top.m, duck: top.duck, score: top.score, depth }
    // Next iteration starts from the true best-first order.
    order = scored.map((x) => x.m).concat(order.filter((m) => !scored.some((x) => x.m === m)))
    if (top.score >= MATE - 100) break
  }
  return best
}
