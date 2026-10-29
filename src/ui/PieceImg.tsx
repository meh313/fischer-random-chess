import type { Color, PieceKind } from '../engine'
import type { ResolvedPieceSet } from '../content/types'
import { pieceName } from './names'

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
  /** Decorative copies (the board announces pieces on its squares instead). */
  decorative?: boolean
}

/** Draws one piece from the active set. Falls back to idle art, then to a Unicode glyph. */
export function PieceImg({ set, color, kind, pose, className, decorative }: Props) {
  const key = color + kind
  const art = set?.art[key]
  const src = art ? (pose && art[pose]) || art.idle : undefined
  const label = pieceName(color, kind)
  if (!src) {
    return (
      <span className={`glyph ${className ?? ''}`} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined}>
        {GLYPH[key]}
      </span>
    )
  }
  return <img className={className} src={src} alt={decorative ? '' : label} draggable={false} />
}
