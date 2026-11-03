import { fileOf, piece, rankOf } from '../board'
import type { Square, State } from '../types'
import type { Variant } from '../variant'

const ORTH: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

/** Horse legs: one step orthogonally (the "leg", must be empty), then one diagonally outward. */
function* horseTargets(from: Square): Generator<{ leg: Square; to: Square }> {
  const f = fileOf(from)
  const r = rankOf(from)
  for (const [dx, dy] of ORTH) {
    const lf = f + dx
    const lr = r + dy
    if (lf < 0 || lf > 7 || lr < 0 || lr > 7) continue
    for (const sign of [1, -1]) {
      // perpendicular to the leg direction
      const tf = lf + dx + (dx === 0 ? sign : 0)
      const tr = lr + dy + (dy === 0 ? sign : 0)
      if (tf < 0 || tf > 7 || tr < 0 || tr > 7) continue
      yield { leg: lr * 8 + lf, to: tr * 8 + tf }
    }
  }
}

const legOpen = (s: State, leg: Square) => s.board[leg] === null && s.duck !== leg

export const dragonBishop: Variant = {
  id: 'dragonBishop',
  name: 'Dragon Bishop',
  blurb: 'Bishops also jump like a Xiangqi horse (one step straight, one diagonal; the first step can be blocked). Yes, that is legal here.',

  transformStart(state) {
    return {
      ...state,
      board: state.board.map((p) => (p && p.kind === 'b' ? piece(p.color, 'd') : p)),
    }
  },

  promotionKinds: (base) => base.map((k) => (k === 'b' ? 'd' : k)),

  extraMoves(state, from, p, addTo) {
    if (p.kind !== 'd') return
    for (const { leg, to } of horseTargets(from)) if (legOpen(state, leg)) addTo(to)
  },

  attacksFrom(state, from, p, target) {
    if (p.kind !== 'd') return false
    for (const h of horseTargets(from)) if (h.to === target && legOpen(state, h.leg)) return true
    return false
  },

  extraAttackers(state, target, by) {
    // Horse reach is a knight offset, so candidates are the 8 knight squares around target.
    // The leg belongs to the dragon's square, so recompute targets from there.
    for (const { to: s } of horseTargets(target)) {
      const p = state.board[s]
      if (!p || p.color !== by || p.kind !== 'd') continue
      for (const h of horseTargets(s)) if (h.to === target && legOpen(state, h.leg)) return true
    }
    return false
  },
}
