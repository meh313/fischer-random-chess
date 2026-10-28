import type { Color, GameResult, Move, Piece, PieceKind, Square, State } from './types'
import type { Rng } from './rng'

/**
 * A self-contained rule module. Every hook is optional; the engine composes
 * the registered variants in order. Adding a variant = adding one file here
 * and registering it in variants/index.ts.
 */
export interface Variant {
  id: string
  name: string
  blurb: string
  conflictsWith?: string[]

  /** Initial position as FEN (Chess960). Last registered variant wins. */
  setupFen?(rng: Rng): string
  /** Rewrite the starting position (Dragon Bishop turns bishops into dragons). */
  transformStart?(state: State): State
  /** Promotion choices. Receives the list so far. */
  promotionKinds?(base: readonly PieceKind[]): PieceKind[]
  /**
   * Extra pseudo-legal destinations for a piece. `addTo` validates the square
   * (own pieces and the duck are rejected, enemy pieces become captures).
   */
  extraMoves?(state: State, from: Square, piece: Piece, addTo: (to: Square) => void): void
  /** True if a piece of `by` attacks `target` through this variant's extra moves. */
  extraAttackers?(state: State, target: Square, by: Color): boolean

  /** No check rules: moves are never filtered for king safety (duck chess). */
  noCheck?: boolean
  /** After a piece move the mover must take a second action (duck placement). */
  twoPhase?: boolean
  /** Variant-specific game end (king captured, stalemate wins, ...). */
  adjudicate?(state: State, legal: readonly Move[]): GameResult | null
}
