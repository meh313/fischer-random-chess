import type { Variant } from '../variant'

/**
 * Duck Chess: after every move the mover places the duck on any empty square
 * other than where it just stood. The duck blocks like a piece and cannot be
 * captured. No check: win by capturing the king. A player with no legal move wins.
 */
export const duck: Variant = {
  id: 'duck',
  name: 'Duck Chess',
  blurb: 'After each move, drop the duck on an empty square. Nothing gets through it. Capture the king to win. The duck sees everything.',
  conflictsWith: [],
  noCheck: true,
  twoPhase: true,

  adjudicate(state, legal) {
    if (state.kings.w < 0) return { winner: 'b', reason: 'kingCaptured' }
    if (state.kings.b < 0) return { winner: 'w', reason: 'kingCaptured' }
    if (state.phase === 'move' && legal.length === 0) return { winner: state.turn, reason: 'stalemateWin' }
    return null
  },
}
