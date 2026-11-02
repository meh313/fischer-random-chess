import { useEffect, useMemo, useRef, useState } from 'react'
import { VARIANTS, fromPgn, newChaosSeed, parseChaosSeed, rollVariants, squareName, toPgn } from './engine'
import { loadCinematics, loadGifs, loadMemes, loadPieceSet, loadPieceSetIndex } from './content/loaders'
import type { Cinematic, GifFile, MemeEntry, ResolvedPieceSet } from './content/types'
import { configureAudio, playSfx, unlockAudio } from './audio/sfx'
import { giphyKey } from './memes/giphy'
import { useMemes } from './memes/useMemes'
import { SettingsProvider, useSettings } from './state/settings'
import { useChass } from './state/useChass'
import { Board } from './ui/Board'
import { PieceImg } from './ui/PieceImg'
import { DiceOverlay } from './ui/DiceOverlay'
import { PgnDialog } from './ui/PgnDialog'
import { ReplayBar } from './ui/ReplayBar'
import { SettingsPanel } from './ui/SettingsPanel'
import { COLOR_NAME } from './ui/names'

const VARIANT_ORDER = ['fischer960', 'dragonBishop', 'duck']

function fmtClock(ms: number) {
  const total = Math.max(0, ms)
  if (total < 10_000) return (total / 1000).toFixed(1)
  const s = Math.ceil(total / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function Chass() {
  const { settings, update } = useSettings()
  const [cinematics, setCinematics] = useState<Cinematic[]>([])
  const [memeList, setMemeList] = useState<MemeEntry[]>([])
  const [gifFile, setGifFile] = useState<GifFile | null>(null)
  const [setIndex, setSetIndex] = useState<{ id: string; name: string; placeholder?: boolean }[]>([])
  const [pieceSet, setPieceSet] = useState<ResolvedPieceSet | null>(null)
  const [problems, setProblems] = useState<string[]>([])
  const [variantIds, setVariantIds] = useState<string[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Chaos Dice: `rolling` plays the slot animation, `chaos` remembers the last roll for the share link.
  const [rolling, setRolling] = useState<{ seed: number; ids: string[] } | null>(null)
  const [chaos, setChaos] = useState<{ seed: number; ids: string[] } | null>(null)
  const [copied, setCopied] = useState(false)
  const [pgnOpen, setPgnOpen] = useState(false)
  const [autoplay, setAutoplay] = useState(false)
  const boardRef = useRef<HTMLDivElement>(null)

  const chass = useChass(cinematics, settings)
  const memes = useMemes(memeList, gifFile, settings)
  const { game } = chass
  // A new game drops memes still pending from the old one.
  useEffect(() => memes.reset(), [game, memes.reset])

  // Content is data: load it once, report problems without crashing the game.
  useEffect(() => {
    const note = (what: string) => (err: unknown) => setProblems((p) => [...p, `${what}: ${(err as Error).message}`])
    loadCinematics()
      .then(({ items, problems: bad }) => {
        setCinematics(items)
        if (bad.length) setProblems((p) => [...p, ...bad.map((b) => `cinematics: ${b}`)])
      })
      .catch(note('cinematics'))
    loadMemes().then(setMemeList).catch(note('memes'))
    loadGifs()
      .then(({ file, problems: bad }) => {
        setGifFile(file)
        if (bad.length) setProblems((p) => [...p, ...bad])
      })
      .catch(note('gifs'))
    loadPieceSetIndex().then(setSetIndex).catch(note('piece sets'))
  }, [])

  useEffect(() => {
    loadPieceSet(settings.pieceSet)
      .then(setPieceSet)
      .catch((err: Error) => {
        setProblems((p) => [...p, `piece set "${settings.pieceSet}": ${err.message}`])
        if (settings.pieceSet !== 'classic') update({ pieceSet: 'classic' }) // never leave the board stuck loading
      })
  }, [settings.pieceSet])

  useEffect(() => configureAudio(settings.sound, settings.volume), [settings.sound, settings.volume])

  // Sound and memes listen to the same typed events as everything else.
  useEffect(
    () =>
      chass.subscribe((e, meta) => {
        switch (e.type) {
          case 'move':
            if (!e.move.capture) void playSfx(e.move.castle ? 'castle' : 'move')
            break
          case 'capture':
            if (!meta.cinematic) void playSfx('capture')
            break
          case 'check':
            setTimeout(() => void playSfx('check'), 120)
            break
          case 'promotion':
            void playSfx('promote')
            break
          case 'duckPlaced':
            void playSfx('duck')
            break
          case 'checkmate':
            void playSfx('mate')
            break
          case 'draw':
          case 'stalemate':
            void playSfx('draw')
            break
          case 'blunder':
            void playSfx('blunder')
            break
        }
        memes.trigger(e)
      }),
    [chass.subscribe, memes.trigger], // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (rollingRef.current) finishRollRef.current()
        chass.skipCine()
        memes.dismiss()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chass.skipCine, memes.dismiss]) // eslint-disable-line react-hooks/exhaustive-deps

  const setSeedParam = (seed: number | null) => {
    try {
      const url = new URL(window.location.href)
      if (seed === null) url.searchParams.delete('chaos')
      else url.searchParams.set('chaos', String(seed))
      window.history.replaceState(null, '', url)
    } catch {
      /* not critical: the share link just will not update */
    }
  }

  const clearChaos = () => {
    setChaos(null)
    setSeedParam(null)
  }

  const rollingRef = useRef(rolling)
  rollingRef.current = rolling
  const finishRollRef = useRef<() => void>(() => {})

  const toggleVariant = (id: string, on: boolean) => {
    const next = on ? [...variantIds, id] : variantIds.filter((v) => v !== id)
    setVariantIds(next)
    clearChaos()
    chass.newGame(next)
  }

  const rollDice = (seed = newChaosSeed()) => {
    setRolling({ seed, ids: rollVariants(seed) })
  }

  const finishRoll = () => {
    if (!rolling) return
    setVariantIds(rolling.ids)
    setChaos(rolling)
    setSeedParam(rolling.seed)
    chass.newGame(rolling.ids, rolling.seed)
    setRolling(null)
  }

  finishRollRef.current = finishRoll

  // A shared link (?chaos=SEED) rolls the same dice for everyone.
  const linkHandled = useRef(false)
  useEffect(() => {
    if (linkHandled.current) return
    linkHandled.current = true
    const seed = parseChaosSeed(new URLSearchParams(window.location.search).get('chaos'))
    if (seed !== null) rollDice(seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const today = () => {
    const d = new Date()
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  const importPgn = (text: string): string | null => {
    try {
      const parsed = fromPgn(text)
      chass.loadReplay(parsed)
      setVariantIds(parsed.game.variantIds)
      clearChaos()
      setAutoplay(false)
      setPgnOpen(false)
      return null
    } catch (e) {
      return (e as Error).message
    }
  }

  // Autoplay steps forward after any gag has finished, and stops at the end.
  useEffect(() => {
    const r = chass.replay
    if (!autoplay || !r) return
    if (r.cursor >= r.actions.length) {
      setAutoplay(false)
      return
    }
    if (chass.cine) return
    const t = window.setTimeout(() => chass.replayForward(), 900)
    return () => clearTimeout(t)
  }, [autoplay, chass.replay, chass.cine, chass.replayForward])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked: the address bar already holds the link */
    }
  }

  const result = game.result
  const resultText = useMemo(() => {
    if (!result) return null
    const name = (c: 'w' | 'b') => settings.names[c] || (c === 'w' ? 'White' : 'Black')
    const who = result.winner ? name(result.winner) : null
    switch (result.reason) {
      case 'checkmate': return `Checkmate. ${who} wins.`
      case 'kingCaptured': return `King captured. ${who} wins.`
      case 'stalemateWin': return `No legal moves. ${who} wins.`
      case 'resign': return `${who} wins by resignation.`
      case 'timeout': return `${who} wins on time.`
      case 'stalemate': return 'Stalemate. Draw.'
      case 'fiftyMove': return 'Draw by the 50-move rule.'
      case 'threefold': return 'Draw by threefold repetition.'
      case 'insufficient': return 'Draw by insufficient material.'
    }
  }, [result, settings.names])

  const pairs: { n: number; w?: string; b?: string }[] = []
  game.records.forEach((r) => {
    const text = r.san + (r.duck !== undefined ? ` @${squareName(r.duck)}` : '')
    if (r.color === 'w') pairs.push({ n: pairs.length + 1, w: text })
    else if (pairs.length && !pairs[pairs.length - 1]!.b && pairs[pairs.length - 1]!.w) pairs[pairs.length - 1]!.b = text
    else pairs.push({ n: pairs.length + 1, b: text })
  })

  const lastRecord = game.records[game.records.length - 1]
  const announce = resultText
    ? resultText
    : [
        lastRecord ? `${COLOR_NAME[lastRecord.color]} played ${lastRecord.san}${lastRecord.duck !== undefined ? `, duck on ${squareName(lastRecord.duck)}` : ''}.` : '',
        game.inCheck ? 'Check.' : '',
        `${COLOR_NAME[game.turn]} to ${game.state.phase === 'duck' ? 'place the duck' : 'move'}.`,
      ]
        .filter(Boolean)
        .join(' ')
  const stateLabel = result ? 'Game over' : game.inCheck ? 'Check' : 'Normal'
  const variantLabel = game.variants.length ? game.variants.map((v) => v.name).join(' + ') : 'Standard'
  const phaseLabel = game.state.phase === 'duck' ? 'Place duck' : 'Move piece'
  const ready = !!pieceSet

  return (
    <div className="app" onPointerDown={unlockAudio}>
      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>
      <header>
        <h1>CHASS</h1>
        <p>The Ultimate Random Chess Experience</p>
      </header>

      {problems.length > 0 && (
        <div className="problems" role="alert">
          {problems.map((p) => (
            <div key={p}>Content problem: {p}</div>
          ))}
        </div>
      )}

      <div className="layout">
        <aside className="col">
          <section className="card c-status">
            <h2>Game Status</h2>
            <div className="kv"><span>Turn</span><b className={game.turn === 'w' ? '' : 'dim'}>{game.turn === 'w' ? 'White' : 'Black'}</b></div>
            <div className="kv"><span>Phase</span><b className={game.state.phase === 'duck' ? 'accent' : ''}>{phaseLabel}</b></div>
            <div className="kv"><span>State</span><b className={game.inCheck || result ? 'danger' : ''}>{stateLabel}</b></div>
            <div className="kv"><span>Variant</span><b>{variantLabel}</b></div>
          </section>

          <section className="card c-variants">
            <h2>Game Variants</h2>
            {VARIANT_ORDER.map((id) => {
              const v = VARIANTS[id]!
              return (
                <div className="row" key={id}>
                  <div>
                    <div className="label">{v.name}</div>
                    <div className="hint">{v.blurb}</div>
                  </div>
                  <label className="switch" htmlFor={`v-${id}`}>
                    <input id={`v-${id}`} type="checkbox" checked={variantIds.includes(id)} onChange={(e) => toggleVariant(id, e.target.checked)} />
                    <span />
                  </label>
                </div>
              )
            })}
            <div className="dice-row">
              <button className="btn dice-btn" onClick={() => rollDice()} disabled={!!rolling}>
                Roll the Chaos Dice
              </button>
              {chaos && (
                <div className="dice-info">
                  <span>Chaos seed {chaos.seed}</span>
                  <button className="btn small" onClick={copyLink}>
                    {copied ? 'Copied' : 'Copy link'}
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="card c-controls">
            <h2>Controls</h2>
            <div className="grid2">
              <button
                className="btn primary"
                onClick={() => {
                  clearChaos()
                  chass.newGame(variantIds)
                }}
              >
                New Game
              </button>
              <button className="btn" onClick={chass.undo} disabled={!chass.canUndo}>Undo</button>
              <button className="btn" onClick={() => chass.setFlipped(!chass.flipped)} disabled={!!chass.cine}>Flip Board</button>
              <button className="btn" onClick={() => setSettingsOpen(true)}>Settings</button>
              <button className="btn" onClick={() => setPgnOpen(true)}>PGN</button>
              <button className="btn" onClick={chass.resign} disabled={!!result || !!chass.replay}>Resign</button>
            </div>
            <label className="field opp">
              <span>Opponent</span>
              <select value={settings.opponent} onChange={(e) => update({ opponent: e.target.value as typeof settings.opponent })} aria-label="Opponent">
                <option value="human">Another person</option>
                <option value="easy">Computer: easy</option>
                <option value="medium">Computer: medium</option>
                <option value="hard">Computer: hard</option>
              </select>
            </label>
          </section>

          <section className="card c-history">
            <h2>Move History</h2>
            <div className="history" aria-label="Move history">
              {pairs.length === 0 && <div className="empty">No moves yet</div>}
              {pairs.map((p) => (
                <div className="hrow" key={p.n}>
                  <span className="dim">{p.n}.</span>
                  <span>{p.w ?? '...'}</span>
                  <span>{p.b ?? ''}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <main className="center">
          {chass.replay && (
            <ReplayBar
              replay={chass.replay}
              autoplay={autoplay}
              onAutoplay={setAutoplay}
              onBack={chass.replayBack}
              onForward={chass.replayForward}
              onJump={(i) => {
                setAutoplay(false)
                chass.replayTo(i)
              }}
              onPlayFromHere={() => {
                setAutoplay(false)
                chass.exitReplay()
              }}
            />
          )}
          <div className="board-wrap">
            {ready ? <Board ref={boardRef} chass={chass} set={pieceSet} flash={memes.active} onFlashEnd={memes.dismiss} /> : <div className="board loading">Loading pieces...</div>}
            {rolling && <DiceOverlay key={rolling.seed} ids={rolling.ids} seed={rolling.seed} onDone={finishRoll} />}
          </div>
          {settings.memes && settings.gifs && giphyKey() && (
            <a className="giphy-credit" href="https://giphy.com" target="_blank" rel="noreferrer">Powered by GIPHY</a>
          )}
          <div className={`banner ${resultText ? 'show' : ''}`} role="status">{resultText ?? ' '}</div>
        </main>

        <aside className="col">
          {(['w', 'b'] as const).map((c) => (
            <section
              className={`card player ${chass.activeClock === c ? 'active' : ''}`}
              key={c}
              style={{ ['--pos' as string]: (c === 'w') === !chass.flipped ? 2 : 0 }}
            >
              <div className="phead">
                <h2>
                  {c === 'w' ? 'White' : 'Black'} Player
                  {settings.opponent !== 'human' && c !== settings.playAs && <span className="ai-tag">{chass.thinking ? 'Computer: thinking...' : 'Computer'}</span>}
                </h2>
                <span className={`dot ${c}`} />
              </div>
              <label className="field">
                <span>Name</span>
                <input
                  type="text"
                  value={settings.names[c]}
                  maxLength={24}
                  onChange={(e) => update({ names: { ...settings.names, [c]: e.target.value } })}
                />
              </label>
              <div className="field">
                <span>Time</span>
                <div className={`clock ${chass.clock && chass.clock[c] < 10_000 ? 'low' : ''}`}>
                  {chass.clock ? fmtClock(chass.clock[c]) : '∞'}
                </div>
              </div>
            </section>
          ))}

          <section className="card c-instr">
            <h2>Instructions</h2>
            <div className="instr">
              <p><b>Standard Chess:</b> Click a piece, then a highlighted square. Captures may trigger a gag. Click or press Esc to skip it.</p>
              {game.variants.map((v) => (
                <p key={v.id}><b>{v.name}:</b> {v.blurb}</p>
              ))}
            </div>
          </section>

          <section className="card c-legend">
            <h2>Piece Legend</h2>
            <div className="legend">
              {(['k', 'q', 'r', 'd', 'n', 'p'] as const).map((k) => (
                <div key={k} className="leg">
                  <PieceImg set={pieceSet} color="w" kind={k} />
                  <span>{{ k: 'King', q: 'Queen', r: 'Rook', d: 'Dragon Bishop', n: 'Knight', p: 'Pawn' }[k]}</span>
                </div>
              ))}
            </div>
            {pieceSet?.placeholder && <div className="hint">Placeholder art. Final art is dropped in as a piece set.</div>}
          </section>
        </aside>
      </div>

      <PgnDialog
        open={pgnOpen}
        onClose={() => setPgnOpen(false)}
        current={pgnOpen ? toPgn(game, { white: settings.names.w, black: settings.names.b, date: today() }) : ''}
        onImport={importPgn}
      />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} pieceSets={setIndex} />
    </div>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <Chass />
    </SettingsProvider>
  )
}
