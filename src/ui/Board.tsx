import { forwardRef, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { fileOf, rankOf, squareName } from '../engine'
import type { PieceKind, Square } from '../engine'
import type { ResolvedPieceSet } from '../content/types'
import type { ChassController } from '../state/useChass'
import { CinematicLayer } from '../cinematics/CinematicLayer'
import { AimLayer } from '../cinematics/AimLayer'
import { MemeFlash } from '../memes/MemeFlash'
import type { ActiveMeme } from '../memes/useMemes'
import { KIND_NAME, pieceName } from './names'
import { PieceImg } from './PieceImg'
import { useModal } from './useModal'

interface Props {
  chass: ChassController
  set: ResolvedPieceSet | null
  /** Reaction clip to play on one square. */
  flash?: ActiveMeme | null
  onFlashEnd?: () => void
}

const PCT = 12.5
const posFor = (sq: Square, flipped: boolean) => {
  const f = fileOf(sq)
  const r = rankOf(sq)
  return { left: `${(flipped ? 7 - f : f) * PCT}%`, top: `${(flipped ? r : 7 - r) * PCT}%` }
}

export const Board = forwardRef<HTMLDivElement, Props>(function Board({ chass, set, flash, onFlashEnd }, ref) {
  const { game, display, selected, targets, lastMove, checkSq, flipped, duckTargets, promotion, cine } = chass
  const board = game.state.board
  const duckPhase = game.state.phase === 'duck'

  // Keyboard: one tab stop for the whole board, arrow keys move between squares (roving tabindex).
  const [focusSq, setFocusSq] = useState<Square>(12)
  const keyNav = useRef(false)
  const squaresRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!keyNav.current) return
    keyNav.current = false
    squaresRef.current?.querySelector<HTMLElement>(`[data-sq="${focusSq}"]`)?.focus()
  }, [focusSq])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const f = fileOf(focusSq)
    const r = rankOf(focusSq)
    const dir = flipped ? -1 : 1 // arrows follow what you see, so flip the direction on a flipped board
    let nf = f
    let nr = r
    switch (e.key) {
      case 'ArrowRight': nf = f + dir; break
      case 'ArrowLeft': nf = f - dir; break
      case 'ArrowUp': nr = r + dir; break
      case 'ArrowDown': nr = r - dir; break
      case 'Enter':
      case ' ':
        e.preventDefault()
        chass.clickSquare(focusSq)
        return
      case 'Escape':
        chass.clearSelection()
        return
      default:
        return
    }
    e.preventDefault()
    if (nf < 0 || nf > 7 || nr < 0 || nr > 7) return
    keyNav.current = true
    setFocusSq(nr * 8 + nf)
  }

  const label = (sq: Square, isTarget: boolean): string => {
    const p = board[sq]
    const parts = [squareName(sq)]
    if (p) parts.push(pieceName(p.color, p.kind))
    if (sq === game.state.duck) parts.push('the duck')
    if (selected === sq) parts.push('selected')
    if (checkSq === sq) parts.push('in check')
    if (isTarget) parts.push(p ? 'capture available' : duckPhase ? 'duck can go here' : 'legal move')
    return parts.join(', ')
  }

  const squares = []
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const f = flipped ? 7 - col : col
      const r = flipped ? row : 7 - row
      const sq = r * 8 + f
      const dark = (f + r) % 2 === 0
      const isTarget = targets.includes(sq) || (duckPhase && duckTargets.includes(sq))
      const occupied = board[sq] !== null
      const cls = ['sq', dark ? 'dark' : 'light']
      if (selected === sq) cls.push('selected')
      if (lastMove && (lastMove.from === sq || lastMove.to === sq)) cls.push('last')
      if (checkSq === sq) cls.push('check')
      if (isTarget) cls.push(occupied ? 'target-capture' : 'target')
      squares.push(
        <div
          key={sq}
          className={cls.join(' ')}
          data-sq={sq}
          role="button"
          tabIndex={sq === focusSq ? 0 : -1}
          aria-label={label(sq, isTarget)}
          aria-pressed={selected === sq}
          onFocus={() => setFocusSq(sq)}
          onClick={() => chass.clickSquare(sq)}
        >
          {col === 0 && <span className="coord rank" aria-hidden="true">{r + 1}</span>}
          {row === 7 && <span className="coord file" aria-hidden="true">{'abcdefgh'[f]}</span>}
        </div>,
      )
    }
  }

  const duckSq = game.state.duck
  const promoColor = promotion ? game.turn : 'w'
  const choices: PieceKind[] = game.promotionChoices
  const promoRef = useModal<HTMLDivElement>(!!promotion, chass.cancelPromotion)

  return (
    <div className="board" ref={ref}>
      <div className="squares" ref={squaresRef} role="group" aria-label="Chess board. Use the arrow keys to move around and Enter to select." onKeyDown={onKeyDown}>
        {squares}
      </div>
      <div className="pieces" aria-hidden="true">
        {display.map((p) => (
          <div key={p.id} className={`piece ${p.role ?? ''}`} data-pid={p.id} style={posFor(p.sq, flipped)}>
            <PieceImg set={set} color={p.color} kind={p.kind} pose={p.pose} decorative />
          </div>
        ))}
        {duckSq !== null && (
          <div className="piece duck" style={posFor(duckSq, flipped)}>
            <img src={`${import.meta.env.BASE_URL}sprites/duck.svg`} alt="" draggable={false} />
          </div>
        )}
      </div>
      {chass.aims.length > 0 && <AimLayer aims={chass.aims} flipped={flipped} />}
      {flash && <MemeFlash key={flash.key} meme={flash} pos={posFor(flash.square, flipped)} onDone={() => onFlashEnd?.()} />}
      {cine && <CinematicLayer key={cine.key} request={cine} flipped={flipped} setPose={chass.setPose} onDone={chass.endCine} onSound={chass.noteCineSound} />}
      {duckPhase && !game.result && (
        <div className="board-hint" role="status">
          Place the duck on an empty square
        </div>
      )}
      {promotion && (
        <div className="promo" onClick={chass.cancelPromotion}>
          <div className="promo-box" ref={promoRef} role="dialog" aria-modal="true" aria-label="Choose a promotion piece" onClick={(e) => e.stopPropagation()}>
            <div className="promo-title">Promote to</div>
            <div className="promo-row">
              {choices.map((k) => (
                <button key={k} onClick={() => chass.choosePromotion(k)} aria-label={`Promote to ${KIND_NAME[k]}`}>
                  <PieceImg set={set} color={promoColor} kind={k} decorative />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
