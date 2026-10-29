import { fileOf, isKind, opposite, parseSquare, piece, rankOf, squareName } from './board'
import type { Color, Piece, PieceKind, SideCastle, Square, State } from './types'

export const STANDARD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function kingSquares(board: readonly (Piece | null)[]): { w: Square; b: Square } {
  const kings = { w: -1, b: -1 }
  board.forEach((p, i) => {
    if (p && p.kind === 'k') kings[p.color] = i
  })
  return kings
}

/**
 * Parses FEN. Castling accepts KQkq (outermost rook, X-FEN) and Shredder
 * file letters (HAha), so Chess960 positions load. Piece letter D = Dragon Bishop.
 */
export function parseFen(fen: string): State {
  const [placement, turn = 'w', cast = '-', ep = '-', half = '0', full = '1', extra = ''] = fen.trim().split(/\s+/)
  const ranks = placement!.split('/')
  if (ranks.length !== 8) throw new Error(`Bad FEN placement: ${fen}`)

  const board: (Piece | null)[] = Array(64).fill(null)
  let duck: Square | null = null
  ranks.forEach((row, i) => {
    const r = 7 - i
    let f = 0
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') {
        f += Number(ch)
        continue
      }
      if (ch === '*') {
        // Duck chess: '*' marks the duck's square (same convention Fairy-Stockfish uses for walls).
        if (duck !== null || f > 7) throw new Error(`Bad FEN duck in ${fen}`)
        duck = r * 8 + f
        f++
        continue
      }
      const kind = ch.toLowerCase()
      if (!isKind(kind) || f > 7) throw new Error(`Bad FEN piece '${ch}' in ${fen}`)
      board[r * 8 + f] = piece(ch === ch.toUpperCase() ? 'w' : 'b', kind)
      f++
    }
    if (f !== 8) throw new Error(`Bad FEN rank '${row}' in ${fen}`)
  })

  const kings = kingSquares(board)
  const castle = { w: { k: null, q: null } as SideCastle, b: { k: null, q: null } as SideCastle }
  if (cast !== '-') {
    for (const ch of cast) {
      const color: Color = ch === ch.toUpperCase() ? 'w' : 'b'
      const back = color === 'w' ? 0 : 7
      const king = kings[color]
      if (king < 0 || rankOf(king) !== back) continue
      const kf = fileOf(king)
      const isRook = (f: number) => {
        const p = board[back * 8 + f]
        return !!p && p.color === color && p.kind === 'r'
      }
      const lower = ch.toLowerCase()
      if (lower === 'k') {
        for (let f = 7; f > kf; f--) if (isRook(f)) { castle[color].k = f; break }
      } else if (lower === 'q') {
        for (let f = 0; f < kf; f++) if (isRook(f)) { castle[color].q = f; break }
      } else if (lower >= 'a' && lower <= 'h') {
        const f = lower.charCodeAt(0) - 97
        if (isRook(f)) castle[color][f > kf ? 'k' : 'q'] = f
      }
    }
  }

  return {
    board,
    turn: turn === 'b' ? 'b' : 'w',
    castle,
    ep: ep === '-' ? null : parseSquare(ep),
    halfmove: Number(half) || 0,
    fullmove: Number(full) || 1,
    kings,
    // An optional 7th field 'D' means the mover still has to place the duck.
    phase: extra === 'D' ? 'duck' : 'move',
    duck,
  }
}

export function fenPlacement(state: State): string {
  const rows: string[] = []
  for (let r = 7; r >= 0; r--) {
    let row = ''
    let empty = 0
    for (let f = 0; f < 8; f++) {
      if (state.duck === r * 8 + f) {
        if (empty) {
          row += empty
          empty = 0
        }
        row += '*'
        continue
      }
      const p = state.board[r * 8 + f]
      if (!p) {
        empty++
        continue
      }
      if (empty) { row += empty; empty = 0 }
      row += p.color === 'w' ? p.kind.toUpperCase() : p.kind
    }
    if (empty) row += empty
    rows.push(row)
  }
  return rows.join('/')
}

export function fenCastling(state: State): string {
  let out = ''
  for (const color of ['w', 'b'] as const) {
    const back = color === 'w' ? 0 : 7
    const kf = state.kings[color] >= 0 ? fileOf(state.kings[color]) : 4
    for (const side of ['k', 'q'] as const) {
      const rf = state.castle[color][side]
      if (rf === null) continue
      // Outermost rook on that side => K/Q (X-FEN), else Shredder file letter.
      let outermost = true
      const range = side === 'k' ? [rf + 1, 7] : [0, rf - 1]
      for (let f = range[0]!; f <= range[1]!; f++) {
        const p = state.board[back * 8 + f]
        if (p && p.color === color && p.kind === 'r') outermost = false
      }
      let ch = outermost ? side.toUpperCase() : String.fromCharCode(97 + rf).toUpperCase()
      if (rf === kf) ch = side.toUpperCase()
      out += color === 'w' ? ch : ch.toLowerCase()
    }
  }
  return out || '-'
}

export function toFen(state: State): string {
  const ep = state.ep === null ? '-' : squareName(state.ep)
  const duckPhase = state.phase === 'duck' ? ' D' : ''
  return `${fenPlacement(state)} ${state.turn} ${fenCastling(state)} ${ep} ${state.halfmove} ${state.fullmove}${duckPhase}`
}

/** Chess960 back rank from an RNG, as lowercase piece letters. */
export function chess960BackRank(rng: { int(n: number): number }): PieceKind[] {
  const r: (PieceKind | null)[] = Array(8).fill(null)
  r[2 * rng.int(4) + 1] = 'b' // light square
  r[2 * rng.int(4)] = 'b' // dark square
  const free = () => r.map((p, i) => (p === null ? i : -1)).filter((i) => i >= 0)
  r[free()[rng.int(free().length)]!] = 'q'
  for (let n = 0; n < 2; n++) r[free()[rng.int(free().length)]!] = 'n'
  const [a, b, c] = free() as [number, number, number]
  r[a] = 'r'
  r[b] = 'k'
  r[c] = 'r'
  return r as PieceKind[]
}

export function chess960Fen(rng: { int(n: number): number }): string {
  const back = chess960BackRank(rng).join('')
  return `${back}/pppppppp/8/8/8/8/PPPPPPPP/${back.toUpperCase()} w KQkq - 0 1`
}

export { opposite }
