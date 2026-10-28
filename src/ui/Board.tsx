import { forwardRef } from 'react'
import { fileOf, rankOf } from '../engine'
import type { PieceKind, Square } from '../engine'
import type { ResolvedPieceSet } from '../content/types'
import type { ChassController } from '../state/useChass'
import { CinematicLayer } from '../cinematics/CinematicLayer'
import { PieceImg } from './PieceImg'

interface Props {
  chass: ChassController
  set: ResolvedPieceSet | null
}

const PCT = 12.5
const posFor = (sq: Square, flipped: boolean) => {
  const f = fileOf(sq)
  const r = rankOf(sq)
  return { left: `${(flipped ? 7 - f : f) * PCT}%`, top: `${(flipped ? r : 7 - r) * PCT}%` }
}

export const Board = forwardRef<HTMLDivElement, Props>(function Board({ chass, set }, ref) {
  const { game, display, selected, targets, lastMove, checkSq, flipped, duckTargets, promotion, cine } = chass
  const board = game.state.board
  const duckPhase = game.state.phase === 'duck'

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
        <div key={sq} className={cls.join(' ')} data-sq={sq} onClick={() => chass.clickSquare(sq)}>
          {col === 0 && <span className="coord rank">{r + 1}</span>}
          {row === 7 && <span className="coord file">{'abcdefgh'[f]}</span>}
        </div>,
      )
    }
  }

  const duckSq = game.state.duck
  const promoColor = promotion ? game.turn : 'w'
  const choices: PieceKind[] = game.promotionChoices

  return (
    <div className="board" ref={ref}>
      <div className="squares">{squares}</div>
      <div className="pieces">
        {display.map((p) => (
          <div
            key={p.id}
            className={`piece ${p.role ?? ''}`}
            data-pid={p.id}
            style={posFor(p.sq, flipped)}
          >
            <PieceImg set={set} color={p.color} kind={p.kind} pose={p.pose} />
          </div>
        ))}
        {duckSq !== null && (
          <div className="piece duck" style={posFor(duckSq, flipped)} title="The duck">
            <img src={`${import.meta.env.BASE_URL}sprites/duck.svg`} alt="Duck" draggable={false} />
          </div>
        )}
      </div>
      {cine && <CinematicLayer key={cine.key} request={cine} flipped={flipped} setPose={chass.setPose} onDone={chass.skipCine} />}
      {duckPhase && !game.result && <div className="board-hint">Place the duck on an empty square</div>}
      {promotion && (
        <div className="promo" onClick={chass.cancelPromotion}>
          <div className="promo-box" onClick={(e) => e.stopPropagation()}>
            <div className="promo-title">Promote to</div>
            <div className="promo-row">
              {choices.map((k) => (
                <button key={k} onClick={() => chass.choosePromotion(k)} aria-label={`Promote to ${k}`}>
                  <PieceImg set={set} color={promoColor} kind={k} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
