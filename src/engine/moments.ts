import { opposite } from './board'
import { attackersOf, inCheck, isAttacked, legalMoves } from './rules'
import type { Color, Move, PieceKind, Square, State } from './types'
import type { Variant } from './variant'

/**
 * Story beats a single move can create, beyond the plain rules events.
 * Memes, GIFs and captions key off these so they match what just happened.
 */
export const MOMENTS = [
  'hung_queen',
  'hung_piece',
  'queen_lost',
  'queen_trade',
  'free_piece',
  'free_pawn',
  'capture_spree',
  'check_spam',
  'king_walk',
  'comeback',
  'steamroll',
  'underpromotion',
  'bongcloud',
  'missed_en_passant',
  'knight_fork',
  'smothered_mate',
] as const
export type MomentId = (typeof MOMENTS)[number]

export interface Moment {
  id: MomentId
  /** The side that made the move (for hung_* that is the side that blundered). */
  color: Color
  /** The square the moment is about: where the capture landed, the loose piece, the checked king. */
  square: Square
  /** The piece doing it (the mover, or for hung_* the enemy piece that can take). */
  attacker: PieceKind
  /** The piece it happens to, when there is one. */
  victim?: PieceKind
}

/** Earlier moves, oldest first, as the Game records them. */
export interface MoveLog {
  color: Color
  san: string
  move: Move
}

const VALUE: Record<PieceKind, number> = { p: 1, n: 3, b: 3, d: 3, r: 5, q: 9, k: 0 }

/** Material of `color` minus the opponent's, in pawns. */
export function materialBalance(state: State, color: Color): number {
  let sum = 0
  for (const p of state.board) if (p) sum += p.color === color ? VALUE[p.kind] : -VALUE[p.kind]
  return sum
}

/** Pieces of `color` worth at least `min` that the opponent attacks and `color` does not defend. */
function hanging(state: State, color: Color, vs: readonly Variant[], min: number): Set<number> {
  const out = new Set<number>()
  const them = opposite(color)
  for (let s = 0; s < 64; s++) {
    const p = state.board[s]
    if (!p || p.color !== color || p.kind === 'k' || VALUE[p.kind] < min) continue
    if (!attackersOf(state, s, them, vs).length) continue
    if (attackersOf(state, s, color, vs).length) continue
    out.add(s)
  }
  return out
}

/** True when a cheaper enemy piece attacks the piece standing on `sq`. */
function attackedByCheaper(state: State, sq: number, vs: readonly Variant[]): boolean {
  const p = state.board[sq]
  if (!p) return false
  return attackersOf(state, sq, opposite(p.color), vs).some((a) => VALUE[state.board[a]!.kind] < VALUE[p.kind])
}

/**
 * Works out the story beats of `move` (already applied: before -> after).
 * `log` holds the moves before this one. Pure and cheap: a few attack scans, no search.
 */
export function detectMoments(before: State, after: State, move: Move, log: readonly MoveLog[], vs: readonly Variant[]): Moment[] {
  const color = move.piece.color
  const out: Moment[] = []
  const add = (id: MomentId, square: Square = move.to, attacker: PieceKind = move.piece.kind, victimKind: PieceKind | undefined = move.capture?.kind) =>
    out.push({ id, color, square, attacker, victim: victimKind })
  const duck = vs.some((v) => v.twoPhase)
  const victim = move.capture

  const prev = log[log.length - 1]
  const prevByThem = prev && prev.color !== color ? prev : undefined
  // Can the side we just captured from take the capturer back? Uses the board after the move,
  // so lines the move opened count and en passant looks at the landing square.
  const retakeable = !!victim && attackersOf(after, move.to, victim.color, vs).length > 0

  // Captures: queen swaps, free material. Kings only fall in duck chess, where gameOver covers it.
  if (victim && victim.kind !== 'k') {
    if (victim.kind === 'q') {
      if (prevByThem?.move.capture?.kind === 'q') add('queen_trade')
      else if (!retakeable || move.piece.kind !== 'q') add('queen_lost')
      // A queen taking a defended queen is half a trade: the recapture reports it.
    } else {
      const recapture = prevByThem?.move.capture && prevByThem.move.to === move.to
      if (!retakeable && !recapture) add(VALUE[victim.kind] >= 3 ? 'free_piece' : 'free_pawn')
    }
  }

  // A fresh blunder: a piece of ours is now loose that was not before, or we put a big piece next to a cheaper attacker.
  if (!duck) {
    const was = hanging(before, color, vs, 3)
    const now = hanging(after, color, vs, 3)
    // What was risked on the landing square is the moving piece (a pawn for a promotion), not what it became.
    const risked = VALUE[move.piece.kind]
    const fairTrade = !!victim && VALUE[victim.kind] >= risked
    const fresh = [...now].filter((s) => (s === move.to ? !fairTrade && !move.promotion : !was.has(s)))
    if (!fairTrade && !move.promotion && risked >= 5 && attackedByCheaper(after, move.to, vs) && !fresh.includes(move.to)) fresh.push(move.to)
    // Only counts if the opponent can actually take it next move (we did not just give check that forces something else).
    if (fresh.length && !inCheck(after, vs)) {
      const loose = fresh.find((s) => after.board[s]?.kind === 'q') ?? fresh[0]!
      const takers = attackersOf(after, loose, opposite(color), vs)
      const taker = takers.reduce((a, c) => (VALUE[after.board[c]!.kind] < VALUE[after.board[a]!.kind] ? c : a), takers[0]!)
      add(after.board[loose]?.kind === 'q' ? 'hung_queen' : 'hung_piece', loose, after.board[taker]?.kind ?? 'p', after.board[loose]?.kind)
    }
  }

  // Streaks over this side's own recent moves.
  const mine = log.filter((r) => r.color === color)
  const last2 = mine.slice(-2)
  // Three captures in a row only count as a spree when they actually won something (not an even trade sequence).
  if (victim && last2.length === 2 && last2.every((r) => r.move.capture) && (!retakeable || materialBalance(after, color) > 0)) add('capture_spree')
  const gaveCheck = !duck && inCheck(after, vs)
  if (gaveCheck && last2.length === 2 && last2.every((r) => /[+#]$/.test(r.san))) add('check_spam', after.kings[opposite(color)], move.piece.kind, 'k')

  // Early king stroll: the opening of this game (not of a custom FEN), castling still possible, not running from check.
  const canCastle = before.castle[color].k !== null || before.castle[color].q !== null
  // Bongcloud: the king steps up to its second rank in the first moves, e-pawn already gone. The most respected opening.
  const home = color === 'w' ? 4 : 60
  const cloud = color === 'w' ? 12 : 52
  const bongcloud = move.piece.kind === 'k' && !move.castle && move.from === home && move.to === cloud && mine.length <= 2 && canCastle && !inCheck(before, vs)
  if (bongcloud) add('bongcloud', move.to, 'k', undefined)
  else if (move.piece.kind === 'k' && !move.castle && mine.length < 12 && canCastle && !inCheck(before, vs)) add('king_walk')

  // Material swings, measured from before the opponent's last move so a plain recapture is not a "comeback".
  const balAfter = materialBalance(after, color)
  const balPrev = materialBalance(before, color) + (prevByThem?.move.capture ? VALUE[prevByThem.move.capture.kind] : 0)
  if (balPrev <= -3 && balAfter >= 0) add('comeback')
  else if (victim && balAfter >= 8 && balPrev < 8) add('steamroll')

  if (move.promotion && move.promotion !== 'q') add('underpromotion')

  // The brick: en passant was legal and the mover played anything else. It is forced, everyone knows this.
  // Taking that pawn some other way is not a brick.
  if (before.ep !== null && !move.enPassant) {
    const pushed = color === 'w' ? before.ep - 8 : before.ep + 8
    if ((move.captureSq ?? move.to) !== pushed && legalMoves(before, vs).some((m) => m.enPassant)) add('missed_en_passant', before.ep, 'p', 'p')
  }

  // Knight fork: the horsey lands, hits two things that matter (king, queen, rook or a loose piece worth 3+) and survives.
  if (move.piece.kind === 'n' && !duck) {
    const them = opposite(color)
    const hit: Square[] = []
    for (let s = 0; s < 64; s++) {
      const p = after.board[s]
      if (!p || p.color !== them || !attackersOf(after, s, color, vs).includes(move.to)) continue
      const loose = !attackersOf(after, s, them, vs).length
      if (p.kind === 'k' || p.kind === 'q' || p.kind === 'r' || (loose && VALUE[p.kind] >= 3)) hit.push(s)
    }
    // Safe: not attacked by something cheaper (the king does not count: it cannot take a defended knight),
    // defended if attacked at all, and not pinned against its own king.
    const takers = attackersOf(after, move.to, them, vs)
    const cheaper = takers.some((a) => after.board[a]!.kind !== 'k' && VALUE[after.board[a]!.kind] < VALUE.n)
    const defended = attackersOf(after, move.to, color, vs).length > 0
    const lifted = { ...after, board: after.board.map((p, i) => (i === move.to ? null : p)) }
    const pinned = after.kings[color] >= 0 && !isAttacked(after, after.kings[color], them, vs) && isAttacked(lifted, after.kings[color], them, vs)
    const safe = !cheaper && (!takers.length || defended) && !pinned
    if (hit.length >= 2 && safe) {
      const best = [...hit].sort((a, b) => VALUE[after.board[b]!.kind] - VALUE[after.board[a]!.kind])[0]! // the king is worth 0 here, so the real prize wins
      add('knight_fork', move.to, 'n', after.board[best]!.kind)
    }
  }

  // Smothered mate: the knight mates alone while the king's own pieces or the edge block every exit.
  if (gaveCheck && move.piece.kind === 'n' && legalMoves(after, vs).length === 0) {
    const k = after.kings[opposite(color)]
    const kf = k & 7
    const kr = k >> 3
    let smothered = true
    for (let df = -1; df <= 1 && smothered; df++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (!df && !dr) continue
        const f = kf + df
        const r = kr + dr
        if (f < 0 || f > 7 || r < 0 || r > 7) continue
        const sq = after.board[r * 8 + f]
        if (!sq || sq.color === color) {
          smothered = false
          break
        }
      }
    }
    if (smothered) add('smothered_mate', k, 'n', 'k')
  }
  return out
}
