import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Game } from '../engine'
import type { Color, GameEvent, Move, Piece, PieceKind, Square } from '../engine'
import { pickCinematic } from '../content/select'
import type { Cinematic } from '../content/types'
import { parseTimeControl, type Settings } from './settings'

export interface TrackedPiece {
  id: number
  color: Color
  kind: PieceKind
  sq: Square
}

export interface DisplayPiece extends TrackedPiece {
  role?: 'attacker' | 'victim'
  pose?: string
}

export interface CineRequest {
  key: number
  cin: Cinematic
  attackerId: number
  victimId: number
  from: Square
  to: Square
  victimSq: Square
  attacker: Piece
  victim: Piece
}

export interface EventMeta {
  /** True when this capture is being played as a cinematic (it supplies its own sounds). */
  cinematic: boolean
}

type Listener = (e: GameEvent, meta: EventMeta) => void

/** Moves ids with the pieces so the board can animate them. */
function applyTracked(prev: TrackedPiece[], m: Move) {
  const next = prev.map((p) => ({ ...p }))
  const at = (sq: Square) => next.find((p) => p.sq === sq)
  const mover = at(m.from)!
  const rook = m.castle ? at(m.castle.rookFrom) : undefined
  const capturedIdx = m.captureSq !== undefined ? next.findIndex((p) => p.sq === m.captureSq) : -1
  const captured = capturedIdx >= 0 ? prev[capturedIdx] : undefined
  if (capturedIdx >= 0) next.splice(capturedIdx, 1)
  mover.sq = m.to
  if (m.promotion) mover.kind = m.promotion
  if (rook && m.castle) rook.sq = m.castle.rookTo
  return { next, attackerId: mover.id, captured }
}

function trackFromGame(game: Game, startId = 1): TrackedPiece[] {
  const out: TrackedPiece[] = []
  let id = startId
  game.state.board.forEach((p, sq) => {
    if (p) out.push({ id: id++, color: p.color, kind: p.kind, sq })
  })
  return out
}

export function useChass(cinematics: readonly Cinematic[], settings: Settings) {
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const cinRef = useRef(cinematics)
  cinRef.current = cinematics

  const [, bump] = useReducer((n: number) => n + 1, 0)
  const gameRef = useRef<Game | null>(null)
  const trackedRef = useRef<TrackedPiece[]>([])
  const stackRef = useRef<TrackedPiece[][]>([])
  const listeners = useRef(new Set<Listener>())
  const metaRef = useRef<EventMeta>({ cinematic: false })
  const cineKey = useRef(0)

  const [selected, setSelected] = useState<Square | null>(null)
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [cine, setCine] = useState<{ req: CineRequest; hold: TrackedPiece[] } | null>(null)
  const [poses, setPoses] = useState<Record<number, string>>({})
  const [clock, setClock] = useState<{ w: number; b: number } | null>(null)
  const clockCfg = useRef<{ initialMs: number; incrementMs: number } | null>(null)

  const emit = useCallback((e: GameEvent) => {
    for (const l of listeners.current) l(e, metaRef.current)
  }, [])

  const newGame = useCallback(
    (variants: readonly string[]) => {
      const game = new Game({ variants })
      game.on(emit)
      gameRef.current = game
      trackedRef.current = trackFromGame(game)
      stackRef.current = []
      const tc = parseTimeControl(settingsRef.current.timeControl)
      clockCfg.current = tc
      setClock(tc ? { w: tc.initialMs, b: tc.initialMs } : null)
      setSelected(null)
      setPromotion(null)
      setCine(null)
      setPoses({})
      bump()
    },
    [emit],
  )

  if (!gameRef.current) {
    // First render: build synchronously so children always have a game.
    const game = new Game({})
    game.on(emit)
    gameRef.current = game
    trackedRef.current = trackFromGame(game)
    const tc = parseTimeControl(settings.timeControl)
    clockCfg.current = tc
  }
  const game = gameRef.current
  const clockInit = useRef(false)
  useEffect(() => {
    if (clockInit.current) return
    clockInit.current = true
    const tc = clockCfg.current
    setClock(tc ? { w: tc.initialMs, b: tc.initialMs } : null)
  }, [])

  const recomputePoses = useCallback((attackerId?: number, events: GameEvent[] = []) => {
    const g = gameRef.current!
    const next: Record<number, string> = {}
    if (attackerId !== undefined && events.some((e) => e.type === 'capture')) next[attackerId] = 'smug'
    if (g.result?.reason === 'checkmate' || g.inCheck) {
      const king = trackedRef.current.find((p) => p.kind === 'k' && p.color === g.turn)
      if (king) next[king.id] = 'shocked'
    }
    setPoses(next)
  }, [])

  const addIncrement = (color: Color) => {
    const inc = clockCfg.current?.incrementMs ?? 0
    if (inc) setClock((c) => (c ? { ...c, [color]: c[color] + inc } : c))
  }

  const perform = useCallback(
    (m: Move) => {
      const g = gameRef.current!
      const s = settingsRef.current
      const prev = trackedRef.current
      const { next, attackerId, captured } = applyTracked(prev, m)

      let request: CineRequest | null = null
      if (m.capture && captured && s.cinematics && Math.random() < s.cinematicChance) {
        const cin = pickCinematic(
          cinRef.current,
          {
            attacker: m.piece.kind,
            victim: m.capture.kind,
            attackerColor: m.piece.color,
            victimColor: m.capture.color,
            variants: g.variantIds,
          },
          Math.random,
        )
        if (cin) {
          request = {
            key: ++cineKey.current,
            cin,
            attackerId,
            victimId: captured.id,
            from: m.from,
            to: m.to,
            victimSq: m.captureSq ?? m.to,
            attacker: m.piece,
            victim: m.capture,
          }
        }
      }

      metaRef.current = { cinematic: !!request }
      const mover = g.turn
      stackRef.current.push(prev)
      const events = g.play(m)
      trackedRef.current = next
      if (g.variantIds.includes('duck') === false) addIncrement(mover)
      recomputePoses(attackerId, events)
      setSelected(null)
      setPromotion(null)
      if (request) setCine({ req: request, hold: prev })
      bump()
    },
    [recomputePoses],
  )

  const placeDuck = useCallback(
    (sq: Square) => {
      const g = gameRef.current!
      metaRef.current = { cinematic: false }
      const mover = g.turn
      stackRef.current.push(trackedRef.current)
      g.placeDuck(sq)
      addIncrement(mover)
      recomputePoses()
      bump()
    },
    [recomputePoses],
  )

  const clickSquare = useCallback(
    (sq: Square) => {
      const g = gameRef.current!
      if (cine) {
        setCine(null)
        return
      }
      if (g.result) return
      if (g.state.phase === 'duck') {
        if (g.duckSquares().includes(sq)) placeDuck(sq)
        return
      }
      if (selected !== null && g.targetsFrom(selected).includes(sq)) {
        const options = g.legalMoves().filter((m) => m.from === selected && (m.to === sq || m.castle?.rookFrom === sq))
        if (options.some((m) => m.promotion)) {
          setPromotion({ from: selected, to: sq })
          return
        }
        const m = g.findMove(selected, sq)
        if (m) perform(m)
        return
      }
      const p = g.state.board[sq]
      setPromotion(null)
      setSelected(p && p.color === g.turn ? sq : null)
    },
    [cine, selected, perform, placeDuck],
  )

  const choosePromotion = useCallback(
    (kind: PieceKind) => {
      if (!promotion) return
      const m = gameRef.current!.findMove(promotion.from, promotion.to, kind)
      if (m) perform(m)
    },
    [promotion, perform],
  )

  const undo = useCallback(() => {
    const g = gameRef.current!
    if (!g.undo()) return
    const prev = stackRef.current.pop()
    if (prev) trackedRef.current = prev
    setSelected(null)
    setPromotion(null)
    setCine(null)
    recomputePoses()
    bump()
  }, [recomputePoses])

  const resign = useCallback(() => {
    const g = gameRef.current!
    metaRef.current = { cinematic: false }
    g.resign(g.turn)
    bump()
  }, [])

  const skipCine = useCallback(() => setCine(null), [])
  const setPose = useCallback((id: number, pose: string | null) => {
    setPoses((p) => {
      const next = { ...p }
      if (pose === null) delete next[id]
      else next[id] = pose
      return next
    })
  }, [])

  // Clock: runs for the side to move after the first move, paused during cinematics.
  const active = !game.result && game.records.length > 0 && !cine ? game.turn : null
  useEffect(() => {
    if (!clock || !active) return
    let last = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      const dt = now - last
      last = now
      setClock((c) => {
        if (!c) return c
        const left = Math.max(0, c[active] - dt)
        return { ...c, [active]: left }
      })
    }, 100)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, game, clock === null])

  useEffect(() => {
    const g = gameRef.current!
    if (clock && !g.result && clock[g.turn] <= 0) {
      g.timeout(g.turn)
      bump()
    }
  }, [clock])

  const subscribe = useCallback((l: Listener) => {
    listeners.current.add(l)
    return () => {
      listeners.current.delete(l)
    }
  }, [])

  // What the board draws.
  const shown = cine ? cine.hold : trackedRef.current
  const display: DisplayPiece[] = shown.map((p) => {
    const d: DisplayPiece = { ...p, pose: poses[p.id] }
    if (cine) {
      if (p.id === cine.req.attackerId) d.role = 'attacker'
      if (p.id === cine.req.victimId) d.role = 'victim'
    }
    return d
  })

  const last = game.records[game.records.length - 1]
  const targets = selected !== null && !cine && game.state.phase === 'move' ? game.targetsFrom(selected) : []

  const aims = settings.aimMode && !cine && !game.result ? game.aimTargets() : []

  return {
    game,
    display,
    aims,
    selected,
    targets,
    lastMove: last ? { from: last.move.from, to: last.move.to } : null,
    checkSq: game.inCheck ? game.state.kings[game.turn] : null,
    promotion,
    flipped,
    setFlipped,
    cine: cine?.req ?? null,
    clock,
    activeClock: active,
    duckTargets: game.duckSquares(),
    newGame,
    clickSquare,
    choosePromotion,
    cancelPromotion: () => setPromotion(null),
    undo,
    resign,
    skipCine,
    setPose,
    subscribe,
  }
}

export type ChassController = ReturnType<typeof useChass>
