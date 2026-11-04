import { fileOf, opposite, piece, rankOf } from './board'
import { attackersOf, applyMove, DIAG, hasNoCheck, isAttacked, isTwoPhase, legalMoves, ORTH, SLIDE } from './rules'
import type { Dir } from './rules'
import type { Color, Move, Piece, PieceKind, Square, State } from './types'
import type { Variant } from './variant'

/**
 * A chess player's sense of danger: what a capture really wins once every recapture
 * is counted, which attackers may legally start it, and which pieces are en prise.
 * Shared by the aim hands, the hung-piece moments and the tactics detector.
 */

/** Material in pawns. The king is never lost material; as a captor it goes last (see `captorValue`). */
export const TACTICAL_VALUE: Record<PieceKind, number> = { p: 1, n: 3, b: 3, d: 3, r: 5, q: 9, k: 0 }

/** The king as something standing on a square: priceless when it can be taken (duck chess), so taking a defended piece with it never pays. */
const captorValue = (k: PieceKind) => (k === 'k' ? 100 : TACTICAL_VALUE[k])

export interface AimTarget {
  attacker: Square
  victim: Square
}

const onBoard = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8

/** Unit step from `a` toward `b` when they share a line, else null. */
export function lineDir(a: Square, b: Square): Dir | null {
  const df = fileOf(b) - fileOf(a)
  const dr = rankOf(b) - rankOf(a)
  if (!df && !dr) return null
  if (df && dr && Math.abs(df) !== Math.abs(dr)) return null
  return [Math.sign(df), Math.sign(dr)]
}

/** First occupied square walking from `from` in `dir`, or -1. The duck counts as a wall (returns -2). */
function firstPiece(state: State, board: readonly (Piece | null)[], from: Square, dir: Dir): Square {
  let f = fileOf(from) + dir[0]
  let r = rankOf(from) + dir[1]
  while (onBoard(f, r)) {
    const s = r * 8 + f
    if (state.duck === s) return -2
    if (board[s]) return s
    f += dir[0]
    r += dir[1]
  }
  return -1
}

const slidesAlong = (k: PieceKind, dir: Dir) => !!SLIDE[k]?.some((d) => d[0] === dir[0] && d[1] === dir[1])

/** The pawn that just double-pushed, when `by` (the side to move) could take it en passant. */
function epVictim(state: State, by: Color): Square | null {
  if (state.ep === null || by !== state.turn) return null
  const pushed = by === 'w' ? state.ep - 8 : state.ep + 8
  const p = state.board[pushed]
  return p && p.kind === 'p' && p.color !== by ? pushed : null
}

/** Pieces of `by` that can take on `target`: attackersOf plus the en passant captors of a just-pushed pawn. */
export function captors(state: State, target: Square, by: Color, vs: readonly Variant[]): Square[] {
  const out = attackersOf(state, target, by, vs)
  if (epVictim(state, by) === target) {
    const r = rankOf(target)
    for (const df of [-1, 1]) {
      const f = fileOf(target) + df
      if (f < 0 || f > 7) continue
      const s = r * 8 + f
      const p = state.board[s]
      if (p && p.color === by && p.kind === 'p' && !out.includes(s)) out.push(s)
    }
  }
  return out
}

/** Board after the piece on `from` takes on `target` (en passant lands on the ep square). Returns the landing square too. */
function simulateCapture(state: State, from: Square, target: Square): { board: (Piece | null)[]; to: Square } {
  const board = state.board.slice() as (Piece | null)[]
  const p = board[from]!
  let to = target
  if (p.kind === 'p' && epVictim(state, p.color) === target) {
    board[target] = null
    to = state.ep!
  }
  board[from] = null
  const last = p.color === 'w' ? 7 : 0
  board[to] = p.kind === 'p' && rankOf(to) === last ? piece(p.color, 'q') : p
  return { board, to }
}

/**
 * Taking on `target` with the piece on `from` would expose an own piece worth more than the prize
 * to an enemy slider through the vacated square (a relative pin), unless the capture stays on that line.
 */
function exposes(state: State, from: Square, target: Square): boolean {
  const p = state.board[from]!
  const prize = state.board[target] ? captorValue(state.board[target]!.kind) : 0
  for (const dir of [...ORTH, ...DIAG]) {
    const s = firstPiece(state, state.board, from, dir)
    if (s < 0) continue
    const enemy = state.board[s]!
    if (enemy.color === p.color || !slidesAlong(enemy.kind, dir)) continue
    const back: Dir = [-dir[0], -dir[1]]
    const x = firstPiece(state, state.board, from, back)
    if (x < 0) continue
    const own = state.board[x]!
    if (own.color !== p.color || captorValue(own.kind) <= prize) continue
    // Capturing the pinner, or anything else on the line, keeps the shield in place.
    const td = lineDir(from, target)
    const onLine = !!td && ((td[0] === dir[0] && td[1] === dir[1]) || (td[0] === back[0] && td[1] === back[1]))
    if (!onLine) return true
  }
  return false
}

/**
 * May the piece on `from` start an exchange on `target`? Its king must not be left in check (so a pinned piece only
 * captures along its pin, and a king only takes an undefended piece), and it must not drop a bigger piece behind it.
 */
export function canCapture(state: State, from: Square, target: Square, vs: readonly Variant[]): boolean {
  const p = state.board[from]
  if (!p) return false
  if (exposes(state, from, target)) return false
  if (hasNoCheck(vs)) return true
  const { board, to } = simulateCapture(state, from, target)
  const king = p.kind === 'k' ? to : state.kings[p.color]
  if (king < 0) return true
  return !isAttacked({ ...state, board }, king, opposite(p.color), vs)
}

/** Cheapest piece of `by` that may legally start an exchange on `target`, lowest square on ties. */
export function cheapestCaptor(state: State, target: Square, by: Color, vs: readonly Variant[]): Square | undefined {
  let best: Square | undefined
  for (const s of captors(state, target, by, vs)) {
    if (!canCapture(state, s, target, vs)) continue
    if (best === undefined || captorValue(state.board[s]!.kind) < captorValue(state.board[best]!.kind) || (captorValue(state.board[s]!.kind) === captorValue(state.board[best]!.kind) && s < best)) best = s
  }
  return best
}

/**
 * Static exchange evaluation: the material `by` wins by capturing on `target` and trading down with the
 * cheapest piece each time, both sides free to stop. 0 or negative means the capture does not pay.
 * Attackers are recomputed after every capture, so batteries and x-rays appear by themselves.
 */
export function see(state: State, target: Square, by: Color, vs: readonly Variant[]): number {
  const victim = state.board[target]
  if (!victim || victim.color === by) return 0
  if (victim.kind === 'k' && !hasNoCheck(vs)) return 0
  const from = cheapestCaptor(state, target, by, vs)
  return from === undefined ? 0 : seeFrom(state, target, from, vs)
}

/** The exchange on `target` started by the piece on `from` (already known to be able to take), trading down from there. */
function seeFrom(state: State, target: Square, first: Square, vs: readonly Variant[]): number {
  let cur: State = state
  let sq = target
  let side = state.board[first]!.color
  const gain: number[] = [captorValue(state.board[target]!.kind)]
  let d = 0
  for (let from: Square | undefined = first; ; from = cheapestCaptor(cur, sq, side, vs)) {
    if (from === undefined) break
    const mover = cur.board[from]!
    const { board, to } = simulateCapture(cur, from, sq)
    const promoted = board[to]!.kind !== mover.kind
    if (promoted) gain[d] += 8
    d++
    // Speculative: what the other side gets back by recapturing. Unused when nobody can.
    gain[d] = captorValue(board[to]!.kind) - gain[d - 1]
    cur = { ...cur, board, ep: null, kings: mover.kind === 'k' ? { ...cur.kings, [mover.color]: to } : cur.kings }
    sq = to
    side = opposite(side)
  }
  while (--d > 0) gain[d - 1] = -Math.max(-gain[d - 1], gain[d])
  return gain[0]!
}

/** The piece on `sq` as its opponent sees it: what taking it wins and who starts. null when it is safe. */
export function enPrise(state: State, sq: Square, vs: readonly Variant[]): { loss: number; by: Square } | null {
  const p = state.board[sq]
  if (!p) return null
  if (p.kind === 'k' && !hasNoCheck(vs)) return null
  const them = opposite(p.color)
  const by = cheapestCaptor(state, sq, them, vs)
  if (by === undefined) return null
  const loss = seeFrom(state, sq, by, vs)
  return loss > 0 ? { loss, by } : null
}

/** Legal moves of the side to move that checkmate. Empty in no-check or two-phase variants. */
export function matesInOne(state: State, vs: readonly Variant[], legal?: readonly Move[]): Move[] {
  if (hasNoCheck(vs) || isTwoPhase(vs) || state.phase !== 'move') return []
  const us = state.turn
  const them = opposite(us)
  const out: Move[] = []
  for (const m of legal ?? legalMoves(state, vs)) {
    const next = applyMove(state, m, vs)
    const k = next.kings[them]
    if (k < 0 || !isAttacked(next, k, us, vs)) continue
    if (legalMoves(next, vs).length === 0) out.push(m)
  }
  return out
}

/** Does the side that just moved threaten mate in one if the opponent passes? */
export function threatensMate(state: State, vs: readonly Variant[]): boolean {
  if (hasNoCheck(vs) || isTwoPhase(vs) || state.phase !== 'move') return false
  const nullMove: State = { ...state, turn: opposite(state.turn), ep: null }
  if (isAttacked(nullMove, nullMove.kings[nullMove.turn], state.turn, vs)) return false
  return matesInOne(nullMove, vs).length > 0
}

/** A line scan result: slider S sees enemy `front`, and behind it enemy `behind`. */
export interface Line {
  piece: Square
  front: Square
  behind: Square
  dir: Dir
}

/** Every slider of `color` with two enemy pieces in a row on one of its rays (pins and skewers, unclassified). */
export function lines(state: State, color: Color): Line[] {
  const out: Line[] = []
  for (let s = 0; s < 64; s++) {
    const p = state.board[s]
    if (!p || p.color !== color) continue
    const dirs = SLIDE[p.kind]
    if (!dirs) continue
    for (const dir of dirs) {
      const front = firstPiece(state, state.board, s, dir)
      if (front < 0 || state.board[front]!.color === color) continue
      const behind = firstPiece(state, state.board, front, dir)
      if (behind < 0 || state.board[behind]!.color === color) continue
      out.push({ piece: s, front, behind, dir })
    }
  }
  return out
}

/** Taking the piece on `sq` with `by` lets the victim's side mate in one: the piece is poisoned. */
function poisoned(state: State, sq: Square, by: Square, vs: readonly Variant[]): boolean {
  if (hasNoCheck(vs) || isTwoPhase(vs)) return false
  const captor = state.board[by]!
  const { board, to } = simulateCapture(state, by, sq)
  const next: State = { ...state, board, ep: null, turn: opposite(captor.color), kings: captor.kind === 'k' ? { ...state.kings, [captor.color]: to } : state.kings }
  return matesInOne(next, vs).length > 0
}

/**
 * The obvious dangers for the side to move, the ones a player sees at a glance (kings excluded): a piece
 * attacked by something cheaper, or attacked with nothing at all covering it. Subtle losses (a defender that
 * is pinned, an x-ray battery, a long exchange) get no hand: a warning for those would be coaching, and the
 * hands are a gag, not an engine. The attacker must be able to take right now (not pinned, a king only on
 * a loose piece); a poisoned piece (taking it allows mate in one) is bait, not a target.
 * In duck chess only knight, pawn and king attacks count: any line can be ducked.
 */
export function aimTargets(state: State, vs: readonly Variant[]): AimTarget[] {
  const us = state.turn
  const out: (AimTarget & { loss: number })[] = []
  const duckGame = isTwoPhase(vs)
  for (let s = 0; s < 64; s++) {
    const p = state.board[s]
    if (!p || p.color !== us || p.kind === 'k') continue
    // It must really be lost (static exchange: no hand at a piece covered through its attacker)...
    const e = enPrise(state, s, vs)
    if (!e) continue
    const captor = state.board[e.by]!.kind
    if (duckGame && captor !== 'p' && captor !== 'n' && captor !== 'k') continue
    // ...and obviously so: taken by something cheaper, or with nothing standing guard at all.
    const cheaper = captor !== 'k' && TACTICAL_VALUE[captor] < TACTICAL_VALUE[p.kind]
    if (!cheaper && attackersOf(state, s, us, vs).length > 0) continue
    if (poisoned(state, s, e.by, vs)) continue
    out.push({ attacker: e.by, victim: s, loss: e.loss })
  }
  return out.sort((a, b) => b.loss - a.loss || a.victim - b.victim).map(({ attacker, victim }) => ({ attacker, victim }))
}
