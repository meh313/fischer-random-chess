import type { Color, GameEvent, Move, MomentId, Piece, PieceKind, Square } from '../engine'

/**
 * Pure helpers for moment gags (forks, pins, blunders...): which moment of a move gets the gag slot
 * and who stands where, so the cinematic can anchor hands and captions. No React, node-testable.
 */

export type MomentEvent = Extract<GameEvent, { type: 'moment' }>

export interface PieceAt {
  id: number
  color: Color
  kind: PieceKind
  sq: Square
}

/** Which moment gets the gag when one move carries several. Mirrors gifs.json priorities (a test checks). */
/** The only moments worth a second gag right after a capture gag: a capture should resolve in about a second. */
export const CHAIN_AFTER_CAPTURE: readonly MomentId[] = ['missed_mate', 'hung_queen']

export const MOMENT_GAG_ORDER: readonly MomentId[] = [
  'missed_mate',
  'hung_queen',
  'pawn_fork',
  'trapped_piece',
  'hung_piece',
  'skewer',
  'fork',
  'double_attack',
  'knight_fork',
  'discovered_attack',
  'pin',
]

/** The move's moment events that have a gag slot, best first. */
export function momentCandidates(events: readonly GameEvent[]): MomentEvent[] {
  const rank = (id: MomentId) => MOMENT_GAG_ORDER.indexOf(id)
  return events
    .filter((e): e is MomentEvent => e.type === 'moment' && rank(e.moment) >= 0)
    .sort((a, b) => rank(a.moment) - rank(b.moment))
}

export interface MomentGeometry {
  /** The moment's squares: first the piece whose threat it is, then its main target (sq1..sq4 in gags). */
  squares: Square[]
  from: Square
  to: Square
  victimSq: Square
  attackerId: number
  victimId: number
  attacker: Piece
  victim: Piece
  /** Kinds of every other piece involved; a gag's `victim` match hits if any of them matches. */
  victims: PieceKind[]
  extra: { sq: Square; id: number | null }[]
  /** Squares the gag points a hand at (the pieces after the first). */
  aimVictims: Square[]
}

/** Where a moment happens, as the cinematic needs it. Anchors and targets name the same pieces. */
export function momentGeometry(mo: MomentEvent, m: Move, pieces: readonly PieceAt[], moverId: number): MomentGeometry {
  const squares = (mo.squares && mo.squares.length ? mo.squares : [m.to, mo.square]).slice(0, 4)
  const at = (sq: Square) => pieces.find((p) => p.sq === sq)
  const from = squares[0]!
  const victimSq = squares[1] ?? from
  const mover = m.piece.color
  const them: Color = mover === 'w' ? 'b' : 'w'
  const a = at(from)
  const v = at(victimSq)
  const attacker: Piece = a ? { color: a.color, kind: a.kind } : { color: mover, kind: mo.attacker }
  const victim: Piece = v ? { color: v.color, kind: v.kind } : { color: them, kind: mo.victim ?? 'p' }
  const attackerId = a?.id ?? moverId
  return {
    squares,
    from,
    to: from,
    victimSq,
    attackerId,
    victimId: v?.id ?? attackerId,
    attacker,
    victim,
    victims: squares.slice(1).flatMap((sq) => (at(sq) ? [at(sq)!.kind] : [])),
    extra: squares.map((sq) => ({ sq, id: at(sq)?.id ?? null })),
    aimVictims: squares.slice(1),
  }
}
