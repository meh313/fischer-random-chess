import type { Color, PieceKind } from '../engine'

export const KIND_NAME: Record<PieceKind, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
  d: 'dragon bishop',
}

export const COLOR_NAME: Record<Color, string> = { w: 'White', b: 'Black' }

export const pieceName = (color: Color, kind: PieceKind) => `${COLOR_NAME[color]} ${KIND_NAME[kind]}`
