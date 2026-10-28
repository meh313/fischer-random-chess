import type { Color, GameResult, Move, Piece, PieceKind, Square } from './types'

/** Typed game events with full context. UI, cinematics, memes and sound all listen to these. */
export type GameEvent =
  | { type: 'move'; color: Color; move: Move; san: string }
  | {
      type: 'capture'
      color: Color
      attacker: Piece
      victim: Piece
      from: Square
      to: Square
      /** Where the victim stood (differs from `to` for en passant). */
      victimSq: Square
      enPassant: boolean
    }
  | { type: 'castling'; color: Color; side: 'k' | 'q'; kingFrom: Square; kingTo: Square; rookFrom: Square; rookTo: Square }
  | { type: 'promotion'; color: Color; from: Square; to: Square; piece: PieceKind }
  | { type: 'check'; color: Color; kingSq: Square }
  | { type: 'checkmate'; winner: Color; loser: Color; kingSq: Square }
  | { type: 'stalemate'; color: Color }
  | { type: 'duckPlaced'; color: Color; square: Square; previous: Square | null }
  | { type: 'draw'; reason: GameResult['reason'] }
  | { type: 'gameOver'; result: GameResult }
  /** Only emitted when an evaluator is attached. `loss` is centipawns lost by `color`. */
  | { type: 'blunder'; color: Color; move: Move; loss: number }

export type GameEventType = GameEvent['type']
export type GameEventHandler = (event: GameEvent) => void
