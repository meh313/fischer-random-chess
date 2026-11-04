import { opposite } from './board'
import { attackersOf, hasNoCheck, inCheck, legalMoves } from './rules'
import { detectTactics } from './tactics'
import { cheapestCaptor, see, TACTICAL_VALUE } from './threats'
import { threatensMate } from './threats'
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
  'pawn_fork',
  'fork',
  'double_attack',
  'pin',
  'skewer',
  'discovered_attack',
  'trapped_piece',
  'mate_threat',
  'missed_mate',
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
  /** The squares involved, first the piece whose threat it is, then its main target (forks, pins, hands). */
  squares?: Square[]
}

/** What the Game already knows about this move, so detection never regenerates it. */
export interface MomentContext {
  legalBefore?: readonly Move[]
  legalAfter?: readonly Move[]
  /** Moment ids this side produced with its previous move (standing tactics are told once). */
  prev?: readonly MomentId[]
}

/** Earlier moves, oldest first, as the Game records them. */
export interface MoveLog {
  color: Color
  san: string
  move: Move
}

const VALUE = TACTICAL_VALUE

/** Material of `color` minus the opponent's, in pawns. */
export function materialBalance(state: State, color: Color): number {
  let sum = 0
  for (const p of state.board) if (p) sum += p.color === color ? VALUE[p.kind] : -VALUE[p.kind]
  return sum
}

/**
 * Works out the story beats of `move` (already applied: before -> after).
 * `log` holds the moves before this one. Pure and cheap: a few attack scans, no search.
 */
export function detectMoments(before: State, after: State, move: Move, log: readonly MoveLog[], vs: readonly Variant[], ctx: MomentContext = {}): Moment[] {
  const color = move.piece.color
  const legalBefore = () => ctx.legalBefore ?? (ctx.legalBefore = legalMoves(before, vs))
  const legalAfter = () => ctx.legalAfter ?? (ctx.legalAfter = legalMoves(after, vs))
  const out: Moment[] = []
  const add = (id: MomentId, square: Square = move.to, attacker: PieceKind = move.piece.kind, victimKind: PieceKind | undefined = move.capture?.kind, squares?: Square[]) =>
    out.push({ id, color, square, attacker, victim: victimKind, ...(squares ? { squares } : {}) })
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

  // A fresh blunder: a piece of ours can now be taken at a profit (static exchange, pins and the king's limits
  // included), it was safe before, the opponent can really take it this move, and we are not threatening mate ourselves.
  if (!duck && legalAfter().length > 0) {
    const them = opposite(color)
    const gained = victim ? VALUE[victim.kind] : 0
    let best: { sq: Square; net: number; by: Square } | null = null
    for (let s = 0; s < 64; s++) {
      const p = after.board[s]
      if (!p || p.color !== color || p.kind === 'k' || p.kind === 'p') continue
      const loss = see(after, s, them, vs)
      if (loss <= 0) continue
      if (s === move.to ? !!move.promotion : see(before, s, them, vs) > 0) continue
      const net = loss - gained
      if (net <= 0) continue
      if (!legalAfter().some((m) => (m.captureSq ?? m.to) === s)) continue
      const by = cheapestCaptor(after, s, them, vs)
      if (by === undefined) continue
      const better = !best || (p.kind === 'q' && after.board[best.sq]!.kind !== 'q') || (after.board[best.sq]!.kind !== 'q' && net > best.net)
      if (better) best = { sq: s, net, by }
    }
    if (best && !threatensMate(after, vs)) {
      const kind = after.board[best.sq]!.kind
      add(kind === 'q' ? 'hung_queen' : 'hung_piece', best.sq, after.board[best.by]!.kind, kind, [best.by, best.sq])
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
    if ((move.captureSq ?? move.to) !== pushed && legalBefore().some((m) => m.enPassant)) add('missed_en_passant', before.ep, 'p', 'p')
  }

  // Smothered mate: the knight mates alone while the king's own pieces or the edge block every exit.
  if (gaveCheck && move.piece.kind === 'n' && legalAfter().length === 0) {
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

  // Forks, pins, skewers, discovered attacks, trapped pieces, mate threats, missed mates (not in duck chess).
  if (!duck && !hasNoCheck(vs)) out.push(...detectTactics({ before, after, move, vs, legalBefore: legalBefore(), legalAfter: legalAfter(), prev: ctx.prev ?? [] }))
  return out
}
