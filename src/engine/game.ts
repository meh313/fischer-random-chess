import { fileOf, opposite, parseSquare, rankOf, sq } from './board'
import { detectMoments } from './moments'
import type { MomentId } from './moments'
import type { GameEvent, GameEventHandler } from './events'
import { fenCastling, fenPlacement, parseFen, STANDARD_FEN, toFen } from './fen'
import { createRng } from './rng'
import { applyMove, hasNoCheck, inCheck, isTwoPhase, legalMoves, promotionKinds } from './rules'
import { toSan } from './san'
import { aimTargets } from './threats'
import type { AimTarget } from './threats'
import type { Color, GameResult, Move, PieceKind, Square, State } from './types'
import type { Variant } from './variant'
import { resolveVariants } from './variants'

export interface GameOptions {
  variants?: readonly string[]
  /** Seeds randomised setups (Chess960) so server and clients agree. */
  seed?: number
  fen?: string
  /** White-POV centipawn evaluation. Enables 'blunder' events. */
  evaluator?: (state: State) => number
  blunderThreshold?: number
}

export interface MoveRecord {
  color: Color
  san: string
  move: Move
  /** Duck square chosen after this move (duck chess). */
  duck?: Square
}

interface Snapshot {
  /** Resignation or flag: not a board action, the UI must not pop its piece stack for it. */
  forced?: boolean
  state: State
  result: GameResult | null
  keys: string[]
  records: MoveRecord[]
  lastMoments: Record<Color, MomentId[]>
}

export function positionKey(state: State, vs: readonly Variant[] = [], legal?: readonly Move[]): string {
  let ep = '-'
  if (state.ep !== null) {
    const dir = state.turn === 'w' ? 1 : -1
    const pawnRank = rankOf(state.ep) - dir
    const ef = fileOf(state.ep)
    for (const df of [-1, 1]) {
      const f = ef + df
      if (f < 0 || f > 7) continue
      const p = state.board[sq(f, pawnRank)]
      if (p && p.kind === 'p' && p.color === state.turn) ep = String(state.ep)
    }
    // FIDE: the ep square only counts if the capture is actually legal (not pinned).
    if (ep !== '-' && state.phase === 'move' && !(legal ?? legalMoves(state, vs)).some((m) => m.enPassant)) ep = '-'
  }
  return `${fenPlacement(state)} ${state.turn} ${fenCastling(state)} ${ep} ${state.phase} ${state.duck ?? '-'}`
}

/** K v K, K+minor v K, or only same-colored bishops. Dragon bishops always count as mating material. */
export function insufficientMaterial(state: State): boolean {
  const minors: { kind: PieceKind; squareColor: number }[] = []
  for (let s = 0; s < 64; s++) {
    const p = state.board[s]
    if (!p || p.kind === 'k') continue
    if (p.kind === 'n' || p.kind === 'b') minors.push({ kind: p.kind, squareColor: (fileOf(s) + rankOf(s)) & 1 })
    else return false
  }
  if (minors.length <= 1) return true
  if (minors.every((m) => m.kind === 'b')) return minors.every((m) => m.squareColor === minors[0]!.squareColor)
  return false
}

/**
 * Can `color` still deliver mate by any series of legal moves (ignoring what the opponent does)?
 * Bare king, or king plus one minor against a bare king, cannot. Pawns, rooks, queens, dragons always can.
 */
export function canEverMate(state: State, color: Color): boolean {
  let minors = 0
  let others = 0
  let opponentExtra = false
  for (const p of state.board) {
    if (!p || p.kind === 'k') continue
    if (p.color !== color) {
      opponentExtra = true
      continue
    }
    if (p.kind === 'n' || p.kind === 'b') minors++
    else others++
  }
  if (others > 0 || minors >= 2) return true
  return minors === 1 && opponentExtra
}

export class Game {
  readonly variantIds: string[]
  readonly seed: number
  readonly startFen: string
  state: State
  result: GameResult | null = null
  records: MoveRecord[] = []
  evaluator?: (state: State) => number
  blunderThreshold: number

  private readonly vs: Variant[]
  private keys: string[] = []
  private history: Snapshot[] = []
  /** Moment ids each side produced with its last move: standing tactics are told once. */
  private lastMoments: Record<Color, MomentId[]> = { w: [], b: [] }
  private handlers = new Set<GameEventHandler>()

  constructor(opts: GameOptions = {}) {
    this.variantIds = [...(opts.variants ?? [])]
    this.vs = resolveVariants(this.variantIds)
    this.seed = opts.seed ?? Math.floor(Math.random() * 2 ** 32)
    this.evaluator = opts.evaluator
    this.blunderThreshold = opts.blunderThreshold ?? 200

    const rng = createRng(this.seed)
    let fen = opts.fen
    if (!fen) {
      for (const v of this.vs) if (v.setupFen) fen = v.setupFen(rng)
    }
    this.startFen = fen ?? STANDARD_FEN
    let state = parseFen(this.startFen)
    for (const v of this.vs) if (v.transformStart) state = v.transformStart(state)
    this.state = state
    this.keys.push(positionKey(state, this.vs))
    this.result = this.evaluate()
  }

  get variants(): readonly Variant[] {
    return this.vs
  }
  get turn(): Color {
    return this.state.turn
  }
  get fen(): string {
    return toFen(this.state)
  }
  get inCheck(): boolean {
    return inCheck(this.state, this.vs)
  }
  /** Pieces of the side to move that are en prise by static exchange (kings excluded), biggest loss first. */
  aimTargets(): AimTarget[] {
    return this.result || this.state.phase !== 'move' ? [] : aimTargets(this.state, this.vs)
  }
  get promotionChoices(): PieceKind[] {
    return promotionKinds(this.vs)
  }

  on(handler: GameEventHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  legalMoves(): Move[] {
    return this.result ? [] : legalMoves(this.state, this.vs)
  }

  /** Squares the UI may highlight and accept clicks on for the piece on `from`. Includes the rook square for castling. */
  targetsFrom(from: Square): Square[] {
    const out = new Set<Square>()
    for (const m of this.legalMoves()) {
      if (m.from !== from) continue
      out.add(m.to)
      if (m.castle) out.add(m.castle.rookFrom)
    }
    return [...out]
  }

  /** Resolves a click-style move. Prefers the plain move over castling when both land on `to`. */
  findMove(from: Square, to: Square, promotion?: PieceKind): Move | undefined {
    const cands = this.legalMoves().filter((m) => m.from === from && (m.to === to || m.castle?.rookFrom === to))
    const pick = (list: Move[]) =>
      promotion ? list.find((m) => m.promotion === promotion) : list.find((m) => !m.promotion) ?? list[0]
    const rookClick = cands.filter((m) => m.castle?.rookFrom === to)
    if (rookClick.length) return rookClick[0]
    const plain = cands.filter((m) => !m.castle)
    return pick(plain.length ? plain : cands)
  }

  playUci(uci: string): GameEvent[] {
    const from = parseSquare(uci.slice(0, 2))
    const to = parseSquare(uci.slice(2, 4))
    const promo = uci[4] as PieceKind | undefined
    const m = this.findMove(from, to, promo)
    if (!m) throw new Error(`Illegal move: ${uci}`)
    return this.play(m)
  }

  duckSquares(): Square[] {
    if (this.result || this.state.phase !== 'duck') return []
    const out: Square[] = []
    for (let s = 0; s < 64; s++) if (this.state.board[s] === null && s !== this.state.duck) out.push(s)
    return out
  }

  play(move: Move): GameEvent[] {
    if (this.result) throw new Error('Game is over')
    const legalBefore = this.legalMoves()
    const m = legalBefore.find(
      (x) => x.from === move.from && x.to === move.to && x.promotion === move.promotion && !x.castle === !move.castle,
    )
    if (!m) throw new Error('Illegal move')

    this.snapshot()
    const before = this.state
    const color = before.turn
    const after = applyMove(before, m, this.vs)
    // Generated once and handed to SAN, repetition keys, adjudication and the moments.
    const legalAfter = legalMoves(after, this.vs)
    const san = toSan(before, m, this.vs, { legal: legalBefore, after, legalAfter })
    this.state = after
    this.records.push({ color, san, move: m })

    const events: GameEvent[] = [{ type: 'move', color, move: m, san }]
    if (m.capture) {
      events.push({
        type: 'capture',
        color,
        attacker: m.piece,
        victim: m.capture,
        from: m.from,
        to: m.to,
        victimSq: m.captureSq ?? m.to,
        enPassant: !!m.enPassant,
      })
    }
    if (m.castle) {
      events.push({
        type: 'castling',
        color,
        side: m.castle.side,
        kingFrom: m.from,
        kingTo: m.to,
        rookFrom: m.castle.rookFrom,
        rookTo: m.castle.rookTo,
      })
    }
    if (m.promotion) events.push({ type: 'promotion', color, from: m.from, to: m.to, piece: m.promotion })

    if (isTwoPhase(this.vs)) {
      // Turn completes after the duck is placed. A captured king ends the game now.
      this.result = this.evaluate()
    } else {
      this.keys.push(positionKey(after, this.vs, legalAfter))
      this.result = this.evaluate(legalAfter)
      if (inCheck(after, this.vs)) events.push({ type: 'check', color: after.turn, kingSq: after.kings[after.turn] })
      this.maybeBlunder(before, after, color, m, events)
    }
    const moments = detectMoments(before, after, m, this.records.slice(0, -1), this.vs, { legalBefore, legalAfter, prev: this.lastMoments[color] })
    this.lastMoments[color] = moments.map((mo) => mo.id)
    for (const mo of moments) events.push({ type: 'moment', color: mo.color, moment: mo.id, square: mo.square, attacker: mo.attacker, victim: mo.victim, squares: mo.squares })
    this.resultEvents(events)
    this.emit(events)
    return events
  }

  placeDuck(square: Square): GameEvent[] {
    if (!this.duckSquares().includes(square)) throw new Error('Illegal duck placement')
    this.snapshot()
    const s = this.state
    const color = s.turn
    this.state = {
      ...s,
      duck: square,
      phase: 'move',
      turn: opposite(color),
      fullmove: s.fullmove + (color === 'b' ? 1 : 0),
    }
    const last = this.records[this.records.length - 1]
    if (last) last.duck = square
    this.keys.push(positionKey(this.state, this.vs))
    this.result = this.evaluate()
    const events: GameEvent[] = [{ type: 'duckPlaced', color, square, previous: s.duck }]
    this.resultEvents(events)
    this.emit(events)
    return events
  }

  undo(): boolean {
    const snap = this.history.pop()
    if (!snap) return false
    this.state = snap.state
    this.result = snap.result
    this.keys = snap.keys
    this.records = snap.records
    this.lastMoments = snap.lastMoments
    return true
  }

  /** True when the last history entry is a resignation or flag rather than a board action. */
  get forcedEnd(): boolean {
    return !!this.history[this.history.length - 1]?.forced && this.result !== null
  }

  /** How often each position has occurred (keys as in threefold detection). */
  positionCounts(): [string, number][] {
    const m = new Map<string, number>()
    for (const k of this.keys) m.set(k, (m.get(k) ?? 0) + 1)
    return [...m.entries()]
  }

  resign(color: Color): GameEvent[] {
    return this.endWith({ winner: opposite(color), reason: 'resign' })
  }

  timeout(color: Color): GameEvent[] {
    // FIDE 6.9: a flag is only a loss if the opponent could still mate with some sequence of moves.
    const winner = opposite(color)
    if (!hasNoCheck(this.vs) && !canEverMate(this.state, winner)) return this.endWith({ winner: null, reason: 'insufficient' })
    return this.endWith({ winner, reason: 'timeout' })
  }

  private endWith(result: GameResult): GameEvent[] {
    if (this.result) return []
    this.snapshot(true)
    this.result = result
    const events: GameEvent[] = [{ type: 'gameOver', result }]
    this.emit(events)
    return events
  }

  private snapshot(forced = false) {
    this.history.push({
      forced,
      state: this.state,
      result: this.result,
      keys: [...this.keys],
      records: this.records.map((r) => ({ ...r })),
      lastMoments: { w: [...this.lastMoments.w], b: [...this.lastMoments.b] },
    })
  }

  private emit(events: GameEvent[]) {
    for (const e of events) {
      for (const h of [...this.handlers]) {
        try {
          h(e)
        } catch (err) {
          console.error('Game event handler failed', err)
        }
      }
    }
  }

  private maybeBlunder(before: State, after: State, color: Color, move: Move, events: GameEvent[]) {
    if (!this.evaluator) return
    const sign = color === 'w' ? 1 : -1
    const loss = (this.evaluator(before) - this.evaluator(after)) * sign
    if (loss >= this.blunderThreshold) events.push({ type: 'blunder', color, move, loss })
  }

  private resultEvents(events: GameEvent[]) {
    const r = this.result
    if (!r) return
    const s = this.state
    if (r.reason === 'checkmate') {
      const loser = opposite(r.winner!)
      events.push({ type: 'checkmate', winner: r.winner!, loser, kingSq: s.kings[loser] })
    } else if (r.reason === 'stalemate') events.push({ type: 'stalemate', color: s.turn })
    else if (r.reason === 'fiftyMove' || r.reason === 'threefold' || r.reason === 'insufficient') {
      events.push({ type: 'draw', reason: r.reason })
    }
    events.push({ type: 'gameOver', result: r })
  }

  private evaluate(legal: readonly Move[] = legalMoves(this.state, this.vs)): GameResult | null {
    const s = this.state
    for (const v of this.vs) {
      const r = v.adjudicate?.(s, legal)
      if (r) return r
    }
    if (s.phase === 'duck') return null
    if (legal.length === 0) {
      return inCheck(s, this.vs) ? { winner: opposite(s.turn), reason: 'checkmate' } : { winner: null, reason: 'stalemate' }
    }
    if (!hasNoCheck(this.vs) && insufficientMaterial(s)) return { winner: null, reason: 'insufficient' }
    // Automatic draw at 100 half-moves (the 50-move rule).
    if (s.halfmove >= 100) return { winner: null, reason: 'fiftyMove' }
    const key = this.keys[this.keys.length - 1]
    if (this.keys.filter((k) => k === key).length >= 3) return { winner: null, reason: 'threefold' }
    return null
  }
}
