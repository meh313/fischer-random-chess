import { describe, expect, it } from 'vitest'
import { Game } from '../../engine'
import { parseSquare as S } from '../../engine/board'
import { resolveVariants } from '../../engine/variants'
import { applyMove } from '../../engine/rules'
import { positionKey } from '../../engine/game'
import { chooseAction, LEVELS, type AiOptions } from '../search'

const quick: AiOptions = { maxDepth: 3, timeMs: 2000, noise: 0, rng: () => 0.5 }

describe('AI search', () => {
  it('finds mate in one', () => {
    const g = new Game({ fen: 'k7/8/1K6/8/8/8/8/7R w - - 0 1' })
    const a = chooseAction(g.state, [], quick)
    expect(a.kind).toBe('move')
    if (a.kind === 'move') expect([a.move.from, a.move.to]).toEqual([S('h1'), S('h8')])
  })

  it('takes a free queen', () => {
    const g = new Game({ fen: '4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1' })
    const a = chooseAction(g.state, [], quick)
    if (a.kind === 'move') expect(a.move.to).toBe(S('d5'))
  })

  it('does not leave the queen en prise', () => {
    // Black pawn e5 attacks the white queen on d4. After the AI's move the queen must not be capturable for free.
    const g = new Game({ fen: '4k3/8/8/4p3/3Q4/8/8/4K3 w - - 0 1' })
    const a = chooseAction(g.state, [], quick)
    expect(a.kind).toBe('move')
    if (a.kind === 'move') g.play(a.move)
    expect(g.legalMoves().some((m) => m.capture?.kind === 'q')).toBe(false)
  })

  it('respects the time limit', () => {
    const g = new Game()
    const t = performance.now()
    chooseAction(g.state, [], { maxDepth: 8, timeMs: 200, noise: 0 })
    expect(performance.now() - t).toBeLessThan(1500)
  })

  it('duck chess: captures the king when it can, then places the duck legally', () => {
    const g = new Game({ variants: ['duck'], fen: '7k/8/8/8/8/8/8/4K2R w - - 0 1' })
    const a = chooseAction(g.state, resolveVariants(['duck']), quick)
    expect(a.kind).toBe('move')
    if (a.kind === 'move') expect([a.move.from, a.move.to]).toEqual([S('h1'), S('h8')])

    const g2 = new Game({ variants: ['duck'], fen: '4k3/8/8/8/8/8/R7/4K3 w - - 0 1' })
    g2.playUci('a2a5')
    const d = chooseAction(g2.state, resolveVariants(['duck']), quick)
    expect(d.kind).toBe('duck')
    if (d.kind === 'duck') expect(g2.duckSquares()).toContain(d.square)
  })
})

describe('AI endgames and repetition', () => {
  it('converts K+Q vs K into checkmate (mop-up evaluation)', { timeout: 240_000 }, () => {
    const g = new Game({ fen: '8/8/8/3k4/8/8/8/Q3K3 w - - 0 1' })
    let seed = 7
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
    for (let i = 0; i < 70 && !g.result; i++) {
      if (g.turn === 'w') {
        const a = chooseAction(g.state, [], { maxDepth: 5, timeMs: 500, noise: 0, seen: new Map(g.positionCounts()) })
        if (a.kind === 'move') g.play(a.move)
      } else {
        const moves = g.legalMoves()
        g.play(moves[Math.floor(rnd() * moves.length)]!)
      }
    }
    expect(g.result).toEqual({ winner: 'w', reason: 'checkmate' })
  })

  it('avoids a move that would repeat a position for the third time', () => {
    const g = new Game()
    const base: AiOptions = { maxDepth: 2, timeMs: 2000, noise: 0, rng: () => 0.5 }
    const first = chooseAction(g.state, [], base)
    expect(first.kind).toBe('move')
    if (first.kind !== 'move') return
    const key = positionKey(applyMove(g.state, first.move, []), [])
    const second = chooseAction(g.state, [], { ...base, seen: new Map([[key, 2]]) })
    expect(second.kind).toBe('move')
    if (second.kind === 'move') expect(second.move.to === first.move.to && second.move.from === first.move.from).toBe(false)
  })
})

describe('AI plays complete legal games', () => {
  const fast: AiOptions = { maxDepth: 2, timeMs: 150, noise: 40 }
  for (const variants of [[], ['dragonBishop'], ['duck'], ['fischer960', 'dragonBishop', 'duck']]) {
    it(`AI vs AI for ${variants.join('+') || 'standard'}`, { timeout: 120_000 }, () => {
      const g = new Game({ variants, seed: 11 })
      const vs = resolveVariants(variants)
      let actions = 0
      while (!g.result && actions < 60) {
        const a = chooseAction(g.state, vs, fast)
        if (a.kind === 'duck') g.placeDuck(a.square)
        else {
          g.play(a.move)
          if (a.duck !== undefined && g.state.phase === 'duck' && g.duckSquares().includes(a.duck)) g.placeDuck(a.duck)
        }
        actions++
      }
      expect(actions).toBeGreaterThan(10)
    })
  }

  it('levels are ordered by strength settings', () => {
    expect(LEVELS.easy.maxDepth).toBeLessThan(LEVELS.medium.maxDepth)
    expect(LEVELS.medium.maxDepth).toBeLessThan(LEVELS.hard.maxDepth)
  })
})
