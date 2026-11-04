import { fileOf, rankOf, squareName } from './board'
import { applyMove, hasNoCheck, inCheck, legalMoves } from './rules'
import type { Move, PieceKind, State } from './types'
import type { Variant } from './variant'

const LETTER: Record<PieceKind, string> = { p: '', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K', d: 'D' }

/** Legal move lists the caller already has, so SAN does not regenerate them. */
export interface SanContext {
  legal?: readonly Move[]
  after?: State
  legalAfter?: readonly Move[]
}

/** Standard algebraic notation for `move`, played from `state`. */
export function toSan(state: State, move: Move, vs: readonly Variant[], ctx: SanContext = {}): string {
  let s: string
  if (move.castle) {
    s = move.castle.side === 'k' ? 'O-O' : 'O-O-O'
  } else if (move.piece.kind === 'p') {
    s = (move.capture ? 'abcdefgh'[fileOf(move.from)] + 'x' : '') + squareName(move.to)
    if (move.promotion) s += '=' + LETTER[move.promotion]
  } else {
    const others = (ctx.legal ?? legalMoves(state, vs)).filter(
      (m) => m.from !== move.from && m.to === move.to && m.piece.kind === move.piece.kind && !m.castle,
    )
    let dis = ''
    if (others.length) {
      const sameFile = others.some((o) => fileOf(o.from) === fileOf(move.from))
      const sameRank = others.some((o) => rankOf(o.from) === rankOf(move.from))
      if (!sameFile) dis = 'abcdefgh'[fileOf(move.from)]!
      else if (!sameRank) dis = String(rankOf(move.from) + 1)
      else dis = squareName(move.from)
    }
    s = LETTER[move.piece.kind] + dis + (move.capture ? 'x' : '') + squareName(move.to)
  }
  if (!hasNoCheck(vs)) {
    const next = ctx.after ?? applyMove(state, move, vs)
    if (inCheck(next, vs)) s += (ctx.legalAfter ?? legalMoves(next, vs)).length === 0 ? '#' : '+'
  }
  return s
}
