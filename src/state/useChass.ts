import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Game } from '../engine'
import type { Color, GameEvent, Move, Piece, PieceKind, Square } from '../engine'
import { resolveVariants } from '../engine/variants'
import { pickCinematic } from '../content/select'
import type { Cinematic } from '../content/types'
import { AiClient } from '../ai/client'
import { chooseAction, LEVELS, type AiAction } from '../ai/search'
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
  /** True when a cinematic already played (or is playing) its own capture sound. */
  cinematic: boolean
}

type Listener = (e: GameEvent, meta: EventMeta) => void
type Clock = { w: number; b: number }
interface StackEntry {
  pieces: TrackedPiece[]
  clock: Clock | null
}

/** Moves ids with the pieces so the board can animate them. */
function applyTracked(prev: TrackedPiece[], m: Move) {
  const next = prev.map((p) => ({ ...p }))
  const at = (sq: Square) => next.find((p) => p.sq === sq)
  const mover = at(m.from)
  if (!mover) throw new Error('Tracked pieces out of sync with the game')
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

/** Clock text only changes when this changes, so the board re-renders about once a second, not 10 times. */
const displayKey = (ms: number) => (ms < 10_000 ? Math.floor(ms / 100) : 100_000 + Math.ceil(ms / 1000))

const FLAG_GRACE_MS = 10_000

export function useChass(cinematics: readonly Cinematic[], settings: Settings) {
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const cinRef = useRef(cinematics)
  cinRef.current = cinematics

  const [version, bump] = useReducer((n: number) => n + 1, 0)
  const gameRef = useRef<Game | null>(null)
  const trackedRef = useRef<TrackedPiece[]>([])
  const stackRef = useRef<StackEntry[]>([])
  const listeners = useRef(new Set<Listener>())
  const metaRef = useRef<EventMeta>({ cinematic: false })
  const cineKey = useRef(0)
  const ai = useRef<AiClient | null>(null)
  const duckHint = useRef<number | null>(null)
  const [thinking, setThinking] = useState(false)

  const [selected, setSelected] = useState<Square | null>(null)
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null)
  const [flipped, setFlippedState] = useState(settings.opponent !== 'human' && settings.playAs === 'b')
  const [cine, setCine] = useState<{ req: CineRequest; hold: TrackedPiece[] } | null>(null)
  const cineRef = useRef(cine)
  cineRef.current = cine
  const [poses, setPoses] = useState<Record<number, string>>({})

  // Exact clock lives in a ref; the state copy only changes when the displayed text would.
  const [clock, setClock] = useState<Clock | null>(null)
  const clockRef = useRef<Clock | null>(null)
  const clockCfg = useRef<{ initialMs: number; incrementMs: number } | null>(null)
  const shownKeys = useRef({ w: 0, b: 0 })

  // Events (sounds, memes) wait for a cinematic to finish so they do not cover it.
  const deferred = useRef<GameEvent[]>([])
  const cineSounded = useRef(false)

  const publishClock = useCallback((next: Clock | null, force = false) => {
    clockRef.current = next
    if (!next) {
      setClock(null)
      return
    }
    const kw = displayKey(next.w)
    const kb = displayKey(next.b)
    if (force || kw !== shownKeys.current.w || kb !== shownKeys.current.b) {
      shownKeys.current = { w: kw, b: kb }
      setClock({ ...next })
    }
  }, [])

  const deliver = useCallback((e: GameEvent) => {
    for (const l of [...listeners.current]) {
      try {
        l(e, metaRef.current)
      } catch (err) {
        console.error('Event listener failed', err)
      }
    }
  }, [])

  const emit = useCallback(
    (e: GameEvent) => {
      if (cineRef.current || metaRef.current.cinematic) deferred.current.push(e)
      else deliver(e)
    },
    [deliver],
  )

  const resetClock = useCallback(() => {
    const tc = parseTimeControl(settingsRef.current.timeControl)
    clockCfg.current = tc
    publishClock(tc ? { w: tc.initialMs, b: tc.initialMs } : null, true)
  }, [publishClock])

  const newGame = useCallback(
    (variants: readonly string[], seed?: number) => {
      const game = new Game({ variants, seed })
      game.on(emit)
      gameRef.current = game
      trackedRef.current = trackFromGame(game)
      stackRef.current = []
      deferred.current = []
      metaRef.current = { cinematic: false }
      resetClock()
      setSelected(null)
      setPromotion(null)
      setCine(null)
      setPoses({})
      duckHint.current = null
      setFlippedState(settingsRef.current.opponent !== 'human' && settingsRef.current.playAs === 'b')
      bump()
    },
    [emit, resetClock],
  )

  if (!gameRef.current) {
    // First render: build synchronously so children always have a game.
    const first = new Game({})
    first.on(emit)
    gameRef.current = first
    trackedRef.current = trackFromGame(first)
    clockCfg.current = parseTimeControl(settings.timeControl)
    clockRef.current = clockCfg.current ? { w: clockCfg.current.initialMs, b: clockCfg.current.initialMs } : null
    shownKeys.current = clockRef.current ? { w: displayKey(clockRef.current.w), b: displayKey(clockRef.current.b) } : { w: 0, b: 0 }
  }
  const game = gameRef.current
  const clockInit = useRef(false)
  useEffect(() => {
    if (clockInit.current) return
    clockInit.current = true
    setClock(clockRef.current ? { ...clockRef.current } : null)
  }, [])

  // Playing the computer as Black shows the board from Black's side.
  useEffect(() => {
    if (settings.opponent !== 'human') setFlippedState(settings.playAs === 'b')
  }, [settings.opponent, settings.playAs])

  const setFlipped = useCallback((v: boolean) => {
    if (!cineRef.current) setFlippedState(v) // sprites are laid out for one orientation
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
    const c = clockRef.current
    if (inc && c) publishClock({ ...c, [color]: c[color] + inc })
  }

  const finishCine = useCallback(() => {
    if (!cineRef.current) return
    cineRef.current = null
    setCine(null)
    metaRef.current = { cinematic: cineSounded.current }
    const pending = deferred.current
    deferred.current = []
    for (const e of pending) deliver(e)
    metaRef.current = { cinematic: false }
  }, [deliver])

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

      cineSounded.current = false
      metaRef.current = { cinematic: !!request }
      const mover = g.turn
      stackRef.current.push({ pieces: prev, clock: clockRef.current ? { ...clockRef.current } : null })
      const events = g.play(m)
      trackedRef.current = next
      if (!g.variantIds.includes('duck')) addIncrement(mover)
      recomputePoses(attackerId, events)
      setSelected(null)
      setPromotion(null)
      if (request) {
        cineRef.current = { req: request, hold: prev }
        setCine({ req: request, hold: prev })
      } else metaRef.current = { cinematic: false }
      bump()
    },
    [recomputePoses],
  )

  const placeDuck = useCallback(
    (sq: Square) => {
      const g = gameRef.current!
      metaRef.current = { cinematic: false }
      const mover = g.turn
      stackRef.current.push({ pieces: trackedRef.current, clock: clockRef.current ? { ...clockRef.current } : null })
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
      if (cineRef.current) {
        finishCine()
        return
      }
      if (g.result) return
      const cfg = settingsRef.current
      if (cfg.opponent !== 'human' && g.turn !== cfg.playAs) return // the computer's turn
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
    [selected, perform, placeDuck, finishCine],
  )

  const choosePromotion = useCallback(
    (kind: PieceKind) => {
      if (!promotion) return
      const m = gameRef.current!.findMove(promotion.from, promotion.to, kind)
      if (m) perform(m)
    },
    [promotion, perform],
  )

  /** Against the computer you can only undo back to a position where it is your move. */
  const humanHasMoved = (g: Game) => settingsRef.current.opponent === 'human' || g.records.some((r) => r.color === settingsRef.current.playAs)
  const canUndo = game.records.length > 0 && humanHasMoved(game)

  const undo = useCallback(() => {
    const g = gameRef.current!
    const cfg = settingsRef.current
    deferred.current = []
    metaRef.current = { cinematic: false }
    cineRef.current = null
    setCine(null)

    if (g.forcedEnd) {
      // Resignation or flag: take it back without touching the piece stack.
      const reason = g.result?.reason
      const loser = g.result?.winner ? (g.result.winner === 'w' ? 'b' : 'w') : null
      if (!g.undo()) return
      const c = clockRef.current
      if (reason === 'timeout' && c && loser) publishClock({ ...c, [loser]: c[loser] + FLAG_GRACE_MS }, true)
    } else {
      if (!humanHasMoved(g)) return
      let restored: StackEntry | undefined
      do {
        if (!g.undo()) break
        const entry = stackRef.current.pop()
        if (entry) restored = entry
      } while (cfg.opponent !== 'human' && !(g.turn === cfg.playAs && g.state.phase === 'move'))
      if (!restored) return
      trackedRef.current = restored.pieces
      if (restored.clock) publishClock({ ...restored.clock }, true)
    }
    duckHint.current = null
    setSelected(null)
    setPromotion(null)
    recomputePoses()
    bump()
  }, [recomputePoses, publishClock])

  const resign = useCallback(() => {
    const g = gameRef.current!
    const cfg = settingsRef.current
    metaRef.current = { cinematic: false }
    g.resign(cfg.opponent !== 'human' ? cfg.playAs : g.turn)
    bump()
  }, [])

  const setPose = useCallback((id: number, pose: string | null) => {
    setPoses((p) => {
      const next = { ...p }
      if (pose === null) delete next[id]
      else next[id] = pose
      return next
    })
  }, [])

  const noteCineSound = useCallback(() => {
    cineSounded.current = true
  }, [])

  // Clock: runs for the side to move after the first move, paused during cinematics.
  const active = !game.result && game.records.length > 0 && !cine && clock !== null ? game.turn : null
  useEffect(() => {
    if (!active) return
    let last = performance.now()
    const id = setInterval(() => {
      const c = clockRef.current
      const g = gameRef.current!
      const now = performance.now()
      const dt = now - last
      last = now
      if (!c || g.result) return
      const left = Math.max(0, c[active] - dt)
      publishClock({ ...c, [active]: left })
      if (left <= 0) {
        metaRef.current = { cinematic: false }
        g.timeout(active)
        bump()
      }
    }, 100)
    return () => clearInterval(id)
  }, [active, game, publishClock])

  // Computer opponent: think in a worker, wait for any cinematic to finish, then play.
  const aiTurn = settings.opponent !== 'human' && !game.result && game.turn !== settings.playAs
  useEffect(() => {
    const g = gameRef.current!
    const cfg = settingsRef.current
    if (cfg.opponent === 'human' || g.result || cine || promotion || g.turn === cfg.playAs) {
      setThinking(false)
      return
    }
    const level = cfg.opponent // narrowed: never 'human' past the guard above
    if (!ai.current) ai.current = new AiClient()
    const client = ai.current
    let cancelled = false
    let timer = 0
    setThinking(true)
    const pace = (fn: () => void) => {
      timer = window.setTimeout(() => !cancelled && fn(), 350)
    }

    /** Applies an AI action; returns false if it no longer matches a legal move. */
    const apply = (action: AiAction): boolean => {
      if (action.kind === 'duck') {
        if (!g.duckSquares().includes(action.square)) return false
        placeDuck(action.square)
        return true
      }
      const m = g.legalMoves().find((x) => x.from === action.move.from && x.to === action.move.to && x.promotion === action.move.promotion && !x.castle === !action.move.castle)
      if (!m) return false
      duckHint.current = action.duck ?? null
      perform(m)
      return true
    }
    /** Never stall: if the worker fails, think on the main thread briefly, then fall back to any legal move. */
    const fallback = () => {
      try {
        const base = LEVELS[level]
        if (apply(chooseAction(g.state, resolveVariants(g.variantIds), { ...base, maxDepth: Math.min(base.maxDepth, 3), timeMs: 250 }))) return
      } catch {
        /* fall through to a plain legal move */
      }
      if (g.state.phase === 'duck') {
        const sq = g.duckSquares()[0]
        if (sq !== undefined) placeDuck(sq)
      } else {
        const m = g.legalMoves()[0]
        if (m) perform(m)
      }
    }

    if (g.state.phase === 'duck' && duckHint.current !== null && g.duckSquares().includes(duckHint.current)) {
      const sq = duckHint.current
      duckHint.current = null
      pace(() => placeDuck(sq))
    } else {
      client
        .think(g.state, g.variantIds, level, g.positionCounts())
        .then((action) => {
          if (cancelled) return
          pace(() => {
            if (!apply(action)) fallback()
          })
        })
        .catch(() => {
          if (!cancelled) pace(fallback)
        })
    }
    return () => {
      cancelled = true
      clearTimeout(timer)
      client.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, cine, promotion, settings.opponent, settings.playAs])

  useEffect(() => () => ai.current?.dispose(), [])

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
    thinking,
    aiTurn,
    canUndo,
    activeClock: active,
    duckTargets: game.duckSquares(),
    newGame,
    clickSquare,
    choosePromotion,
    cancelPromotion: () => setPromotion(null),
    clearSelection: () => {
      setSelected(null)
      setPromotion(null)
    },
    undo,
    resign,
    skipCine: finishCine,
    noteCineSound,
    setPose,
    subscribe,
  }
}

export type ChassController = ReturnType<typeof useChass>
