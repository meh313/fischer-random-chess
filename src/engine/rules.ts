import { fileOf, opposite, piece, rankOf, sq } from './board'
import type { Color, Move, Piece, PieceKind, Square, State } from './types'
import type { Variant } from './variant'

export type Dir = readonly [number, number]
export const KNIGHT: Dir[] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
export const KING: Dir[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
export const ORTH: Dir[] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
export const DIAG: Dir[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
export const SLIDE: Partial<Record<PieceKind, Dir[]>> = { b: DIAG, d: DIAG, r: ORTH, q: [...ORTH, ...DIAG] }

export const BASE_PROMOTIONS: readonly PieceKind[] = ['q', 'r', 'b', 'n']

export const hasNoCheck = (vs: readonly Variant[]) => vs.some((v) => v.noCheck)
export const isTwoPhase = (vs: readonly Variant[]) => vs.some((v) => v.twoPhase)

export function promotionKinds(vs: readonly Variant[]): PieceKind[] {
  let kinds: PieceKind[] = [...BASE_PROMOTIONS]
  for (const v of vs) if (v.promotionKinds) kinds = v.promotionKinds(kinds)
  return kinds
}

/** Does `by` attack `target`? Sliders stop at any piece or at the duck. */
export function isAttacked(state: State, target: Square, by: Color, vs: readonly Variant[]): boolean {
  const b = state.board
  const tf = fileOf(target)
  const tr = rankOf(target)

  const pr = by === 'w' ? tr - 1 : tr + 1
  if (pr >= 0 && pr < 8) {
    for (const df of [-1, 1]) {
      const f = tf + df
      if (f < 0 || f > 7) continue
      const p = b[pr * 8 + f]
      if (p && p.color === by && p.kind === 'p') return true
    }
  }
  for (const [df, dr] of KNIGHT) {
    const f = tf + df
    const r = tr + dr
    if (f < 0 || f > 7 || r < 0 || r > 7) continue
    const p = b[r * 8 + f]
    if (p && p.color === by && p.kind === 'n') return true
  }
  for (const [df, dr] of KING) {
    const f = tf + df
    const r = tr + dr
    if (f < 0 || f > 7 || r < 0 || r > 7) continue
    const p = b[r * 8 + f]
    if (p && p.color === by && p.kind === 'k') return true
  }
  const scan = (dirs: Dir[], kinds: string): boolean => {
    for (const [df, dr] of dirs) {
      let f = tf + df
      let r = tr + dr
      while (f >= 0 && f < 8 && r >= 0 && r < 8) {
        const s = r * 8 + f
        if (state.duck === s) break
        const p = b[s]
        if (p) {
          if (p.color === by && kinds.includes(p.kind)) return true
          break
        }
        f += df
        r += dr
      }
    }
    return false
  }
  if (scan(ORTH, 'rq') || scan(DIAG, 'bqd')) return true
  for (const v of vs) if (v.extraAttackers?.(state, target, by)) return true
  return false
}

/** Squares of every `by` piece that attacks `target` (own pieces count too: they are defenders). */
export function attackersOf(state: State, target: Square, by: Color, vs: readonly Variant[]): Square[] {
  const out: Square[] = []
  const b = state.board
  const tf = fileOf(target)
  const tr = rankOf(target)
  const at = (f: number, r: number, kinds: string) => {
    if (f < 0 || f > 7 || r < 0 || r > 7) return
    const p = b[r * 8 + f]
    if (p && p.color === by && kinds.includes(p.kind)) out.push(r * 8 + f)
  }
  const pr = by === 'w' ? tr - 1 : tr + 1
  at(tf - 1, pr, 'p')
  at(tf + 1, pr, 'p')
  for (const [df, dr] of KNIGHT) at(tf + df, tr + dr, 'n')
  for (const [df, dr] of KING) at(tf + df, tr + dr, 'k')
  const scan = (dirs: Dir[], kinds: string) => {
    for (const [df, dr] of dirs) {
      let f = tf + df
      let r = tr + dr
      while (f >= 0 && f < 8 && r >= 0 && r < 8) {
        const s = r * 8 + f
        if (state.duck === s) break
        const p = b[s]
        if (p) {
          if (p.color === by && kinds.includes(p.kind)) out.push(s)
          break
        }
        f += df
        r += dr
      }
    }
  }
  scan(ORTH, 'rq')
  scan(DIAG, 'bqd')
  // Variant attackers (dragon horse): find the dragons that reach `target`.
  for (let s = 0; s < 64; s++) {
    const p = b[s]
    if (!p || p.color !== by || p.kind !== 'd' || out.includes(s)) continue
    if (vs.some((v) => v.attacksFrom?.(state, s, p, target))) out.push(s)
  }
  return out
}

export function inCheck(state: State, vs: readonly Variant[], color: Color = state.turn): boolean {
  if (hasNoCheck(vs)) return false
  const k = state.kings[color]
  return k >= 0 && isAttacked(state, k, opposite(color), vs)
}

/** Pseudo-legal moves for the side to move (king safety not yet checked). */
export function pseudoMoves(state: State, vs: readonly Variant[]): Move[] {
  const out: Move[] = []
  const b = state.board
  const us = state.turn
  const noCheck = hasNoCheck(vs)
  const promos = promotionKinds(vs)
  const free = (s: Square) => b[s] === null && state.duck !== s

  for (let s = 0; s < 64; s++) {
    const p = b[s]
    if (!p || p.color !== us) continue
    const f = fileOf(s)
    const r = rankOf(s)

    const addTo = (to: Square) => {
      if (state.duck === to) return
      const t = b[to]
      if (t === null) out.push({ from: s, to, piece: p })
      else if (t!.color !== us) out.push({ from: s, to, piece: p, capture: t!, captureSq: to })
    }

    switch (p.kind) {
      case 'p': {
        const dir = us === 'w' ? 1 : -1
        const start = us === 'w' ? 1 : 6
        const last = us === 'w' ? 7 : 0
        const r1 = r + dir
        if (r1 < 0 || r1 > 7) break
        const emit = (to: Square, extra: Partial<Move> = {}) => {
          if (rankOf(to) === last) {
            for (const k of promos) out.push({ from: s, to, piece: p, ...extra, promotion: k })
          } else out.push({ from: s, to, piece: p, ...extra })
        }
        const one = r1 * 8 + f
        if (free(one)) {
          emit(one)
          if (r === start) {
            const two = (r + 2 * dir) * 8 + f
            if (free(two)) out.push({ from: s, to: two, piece: p, doublePush: true })
          }
        }
        for (const df of [-1, 1]) {
          const cf = f + df
          if (cf < 0 || cf > 7) continue
          const ct = r1 * 8 + cf
          const t = b[ct]
          if (t && t.color !== us) emit(ct, { capture: t, captureSq: ct })
          else if (t === null && state.ep === ct && state.duck !== ct) {
            const cs = r * 8 + cf
            const v = b[cs]
            if (v && v.kind === 'p' && v.color !== us) {
              out.push({ from: s, to: ct, piece: p, capture: v, captureSq: cs, enPassant: true })
            }
          }
        }
        break
      }
      case 'n':
        for (const [df, dr] of KNIGHT) {
          const nf = f + df
          const nr = r + dr
          if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) addTo(nr * 8 + nf)
        }
        break
      case 'k':
        for (const [df, dr] of KING) {
          const nf = f + df
          const nr = r + dr
          if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) addTo(nr * 8 + nf)
        }
        genCastling(state, vs, s, p, noCheck, out)
        break
      default: {
        const dirs = SLIDE[p.kind]
        if (!dirs) break
        for (const [df, dr] of dirs) {
          let nf = f + df
          let nr = r + dr
          while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
            const to = nr * 8 + nf
            if (state.duck === to) break
            const t = b[to]
            addTo(to)
            if (t !== null) break
            nf += df
            nr += dr
          }
        }
      }
    }
    for (const v of vs) v.extraMoves?.(state, s, p, addTo)
  }
  return out
}

/** Chess960-correct castling: king goes to g/c, rook to f/d, from any start files. */
function genCastling(state: State, vs: readonly Variant[], kingSq: Square, king: Piece, noCheck: boolean, out: Move[]) {
  const us = king.color
  const back = us === 'w' ? 0 : 7
  if (rankOf(kingSq) !== back) return
  const rights = state.castle[us]
  const kf = fileOf(kingSq)
  const them = opposite(us)

  for (const side of ['k', 'q'] as const) {
    const rf = rights[side]
    if (rf === null) continue
    const rookFrom = sq(rf, back)
    const rook = state.board[rookFrom]
    if (!rook || rook.kind !== 'r' || rook.color !== us) continue

    const kTo = side === 'k' ? 6 : 2
    const rTo = side === 'k' ? 5 : 3
    const lo = Math.min(kf, kTo, rf, rTo)
    const hi = Math.max(kf, kTo, rf, rTo)
    let clear = true
    for (let f = lo; f <= hi; f++) {
      const s = sq(f, back)
      if (s === kingSq || s === rookFrom) continue
      if (state.board[s] !== null || state.duck === s) { clear = false; break }
    }
    if (!clear) continue

    if (!noCheck) {
      let safe = true
      for (let f = Math.min(kf, kTo); f <= Math.max(kf, kTo); f++) {
        if (isAttacked(state, sq(f, back), them, vs)) { safe = false; break }
      }
      if (!safe) continue
    }
    out.push({
      from: kingSq,
      to: sq(kTo, back),
      piece: king,
      castle: { side, rookFrom, rookTo: sq(rTo, back) },
    })
  }
}

/** Applies a move. Returns a new state; the input is untouched. */
export function applyMove(state: State, m: Move, vs: readonly Variant[]): State {
  const board = state.board.slice() as (Piece | null)[]
  const us = m.piece.color
  const them = opposite(us)
  const kings = { ...state.kings }

  if (m.castle) {
    board[m.from] = null
    board[m.castle.rookFrom] = null
    board[m.to] = m.piece
    board[m.castle.rookTo] = piece(us, 'r')
  } else {
    board[m.from] = null
    if (m.captureSq !== undefined && m.captureSq !== m.to) board[m.captureSq] = null
    board[m.to] = m.promotion ? piece(us, m.promotion) : m.piece
  }
  if (m.piece.kind === 'k') kings[us] = m.to
  if (m.capture && m.capture.kind === 'k') kings[them] = -1

  const castle = { w: { ...state.castle.w }, b: { ...state.castle.b } }
  if (m.piece.kind === 'k') {
    castle[us].k = null
    castle[us].q = null
  }
  const clearRook = (s: Square) => {
    for (const c of ['w', 'b'] as const) {
      if (rankOf(s) !== (c === 'w' ? 0 : 7)) continue
      const f = fileOf(s)
      if (castle[c].k === f) castle[c].k = null
      if (castle[c].q === f) castle[c].q = null
    }
  }
  clearRook(m.from)
  if (m.capture) clearRook(m.captureSq!)

  const twoPhase = isTwoPhase(vs)
  const resets = m.piece.kind === 'p' || !!m.capture
  return {
    board,
    turn: twoPhase ? us : them,
    castle,
    ep: m.doublePush ? (m.from + m.to) / 2 : null,
    halfmove: resets ? 0 : state.halfmove + 1,
    fullmove: state.fullmove + (us === 'b' && !twoPhase ? 1 : 0),
    kings,
    phase: twoPhase ? 'duck' : 'move',
    duck: state.duck,
  }
}

/** Fully legal moves for the side to move (empty during a duck phase). */
export function legalMoves(state: State, vs: readonly Variant[]): Move[] {
  if (state.phase === 'duck') return []
  const pseudo = pseudoMoves(state, vs)
  if (hasNoCheck(vs)) return pseudo
  const us = state.turn
  const them = opposite(us)
  return pseudo.filter((m) => {
    const next = applyMove(state, m, vs)
    return !isAttacked(next, next.kings[us], them, vs)
  })
}

/** Leaf count of the legal move tree. Bulk-counts at depth 1. */
export function perft(state: State, depth: number, vs: readonly Variant[] = []): number {
  const moves = legalMoves(state, vs)
  if (depth <= 1) return moves.length
  let n = 0
  for (const m of moves) n += perft(applyMove(state, m, vs), depth - 1, vs)
  return n
}
