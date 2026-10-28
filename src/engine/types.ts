// Pure engine types. No DOM, no React. Safe to run on a server.

export type Color = 'w' | 'b'

/** p n b r q k, plus 'd' = Dragon Bishop (added by the dragonBishop variant). */
export type PieceKind = 'p' | 'n' | 'b' | 'r' | 'q' | 'k' | 'd'

export interface Piece {
  readonly color: Color
  readonly kind: PieceKind
}

/** 0..63, a1 = 0, b1 = 1, ..., h8 = 63. file = sq & 7, rank = sq >> 3. */
export type Square = number

/** Rook files that still hold a castling right. Works for Chess960. */
export interface SideCastle {
  k: number | null
  q: number | null
}

export interface State {
  readonly board: readonly (Piece | null)[]
  readonly turn: Color
  readonly castle: { readonly w: SideCastle; readonly b: SideCastle }
  /** En passant target square (the square the pawn skipped), or null. */
  readonly ep: Square | null
  readonly halfmove: number
  readonly fullmove: number
  /** King squares, -1 when a king has been captured (duck chess). */
  readonly kings: { readonly w: Square; readonly b: Square }
  /** 'duck' = the mover must now place the duck (duck chess). */
  readonly phase: 'move' | 'duck'
  readonly duck: Square | null
}

export interface Move {
  from: Square
  /** King destination for castling. */
  to: Square
  piece: Piece
  capture?: Piece
  /** Square of the captured piece (differs from `to` for en passant). */
  captureSq?: Square
  promotion?: PieceKind
  enPassant?: boolean
  doublePush?: boolean
  castle?: { side: 'k' | 'q'; rookFrom: Square; rookTo: Square }
}

export type GameResultReason =
  | 'checkmate'
  | 'stalemate'
  | 'stalemateWin'
  | 'kingCaptured'
  | 'fiftyMove'
  | 'threefold'
  | 'insufficient'
  | 'timeout'
  | 'resign'

export interface GameResult {
  /** null = draw */
  winner: Color | null
  reason: GameResultReason
}
