import type { Color, Piece, PieceKind, Square } from './types'

export const sq = (file: number, rank: number): Square => rank * 8 + file
export const fileOf = (s: Square): number => s & 7
export const rankOf = (s: Square): number => s >> 3
export const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w')

export const squareName = (s: Square): string => 'abcdefgh'[s & 7]! + ((s >> 3) + 1)

export function parseSquare(name: string): Square {
  const f = name.charCodeAt(0) - 97
  const r = name.charCodeAt(1) - 49
  if (name.length !== 2 || f < 0 || f > 7 || r < 0 || r > 7) throw new Error(`Bad square: ${name}`)
  return sq(f, r)
}

const KINDS: PieceKind[] = ['p', 'n', 'b', 'r', 'q', 'k', 'd']
const CACHE = new Map<string, Piece>()
for (const color of ['w', 'b'] as const) {
  for (const kind of KINDS) CACHE.set(color + kind, Object.freeze({ color, kind }))
}

/** Shared frozen piece objects. */
export const piece = (color: Color, kind: PieceKind): Piece => CACHE.get(color + kind)!

export const isKind = (c: string): c is PieceKind => KINDS.includes(c as PieceKind)
