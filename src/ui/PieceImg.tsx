import type { Color, PieceKind } from '../engine'
import type { ResolvedPieceSet } from '../content/types'

const GLYPH: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙', wd: '♗',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟', bd: '♝',
}

interface Props {
  set: ResolvedPieceSet | null
  color: Color
  kind: PieceKind
  pose?: string
  className?: string
}

/** Draws one piece from the active set. Falls back to idle art, then to a Unicode glyph. */
export function PieceImg({ set, color, kind, pose, className }: Props) {
  const key = color + kind
  const art = set?.art[key]
  const src = art ? (pose && art[pose]) || art.idle : undefined
  if (!src) return <span className={`glyph ${className ?? ''}`}>{GLYPH[key]}</span>
  return <img className={className} src={src} alt={`${color === 'w' ? 'White' : 'Black'} ${kind}`} draggable={false} />
}
