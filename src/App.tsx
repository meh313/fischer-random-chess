import { useEffect, useMemo, useRef, useState } from 'react'
import { VARIANTS, squareName } from './engine'
import { loadCinematics, loadMemes, loadPieceSet, loadPieceSetIndex } from './content/loaders'
import type { Cinematic, MemeEntry, ResolvedPieceSet } from './content/types'
import { configureAudio, playSfx, unlockAudio } from './audio/sfx'
import { MemeOverlay } from './memes/MemeOverlay'
import { useMemes } from './memes/useMemes'
import { SettingsProvider, useSettings } from './state/settings'
import { useChass } from './state/useChass'
import { Board } from './ui/Board'
import { PieceImg } from './ui/PieceImg'
import { SettingsPanel } from './ui/SettingsPanel'

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
  const [setIndex, setSetIndex] = useState<{ id: string; name: string; placeholder?: boolean }[]>([])
  const [pieceSet, setPieceSet] = useState<ResolvedPieceSet | null>(null)
  const [problems, setProblems] = useState<string[]>([])
  const [variantIds, setVariantIds] = useState<string[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const boardRef = useRef<HTMLDivElement>(null)

  const chass = useChass(cinematics, settings)
  const memes = useMemes(memeList, settings)
  const { game } = chass

  // Content is data: load it once, report problems without crashing the game.
  useEffect(() => {
    const note = (what: string) => (err: unknown) => setProblems((p) => [...p, `${what}: ${(err as Error).message}`])
    loadCinematics().then(setCinematics).catch(note('cinematics'))
    loadMemes().then(setMemeList).catch(note('memes'))
    loadPieceSetIndex().then(setSetIndex).catch(note('piece sets'))
  }, [])

  useEffect(() => {
    loadPieceSet(settings.pieceSet)
      .then(setPieceSet)
      .catch((err: Error) => setProblems((p) => [...p, `piece set "${settings.pieceSet}": ${err.message}`]))
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
        chass.skipCine()
        memes.dismiss()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chass.skipCine, memes.dismiss]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleVariant = (id: string, on: boolean) => {
    const next = on ? [...variantIds, id] : variantIds.filter((v) => v !== id)
    setVariantIds(next)
    chass.newGame(next)
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
  game.records.forEach((r, i) => {
    const text = r.san + (r.duck !== undefined ? ` @${squareName(r.duck)}` : '')
    if (r.color === 'w') pairs.push({ n: pairs.length + 1, w: text })
    else if (pairs.length && !pairs[pairs.length - 1]!.b && pairs[pairs.length - 1]!.w) pairs[pairs.length - 1]!.b = text
    else pairs.push({ n: pairs.length + 1, b: text })
    void i
  })

  const stateLabel = result ? 'Game over' : game.inCheck ? 'Check' : 'Normal'
  const variantLabel = game.variants.length ? game.variants.map((v) => v.name).join(' + ') : 'Standard'
  const phaseLabel = game.state.phase === 'duck' ? 'Place duck' : 'Move piece'
  const ready = !!pieceSet

  return (
    <div className="app" onPointerDown={unlockAudio}>
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
          <section className="card">
            <h2>Game Status</h2>
            <div className="kv"><span>Turn</span><b className={game.turn === 'w' ? '' : 'dim'}>{game.turn === 'w' ? 'White' : 'Black'}</b></div>
            <div className="kv"><span>Phase</span><b className={game.state.phase === 'duck' ? 'accent' : ''}>{phaseLabel}</b></div>
            <div className="kv"><span>State</span><b className={game.inCheck || result ? 'danger' : ''}>{stateLabel}</b></div>
            <div className="kv"><span>Variant</span><b>{variantLabel}</b></div>
          </section>

          <section className="card">
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
          </section>

          <section className="card">
            <h2>Controls</h2>
            <div className="grid2">
              <button className="btn primary" onClick={() => chass.newGame(variantIds)}>New Game</button>
              <button className="btn" onClick={chass.undo} disabled={game.records.length === 0}>Undo</button>
              <button className="btn" onClick={() => chass.setFlipped(!chass.flipped)}>Flip Board</button>
              <button className="btn" onClick={() => setSettingsOpen(true)}>Settings</button>
              <button className="btn wide" onClick={chass.resign} disabled={!!result}>Resign</button>
            </div>
          </section>

          <section className="card">
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
          <div className="board-wrap">
            {ready ? <Board ref={boardRef} chass={chass} set={pieceSet} /> : <div className="board loading">Loading pieces...</div>}
            <MemeOverlay meme={memes.active} muted={!settings.sound} onDismiss={memes.dismiss} />
          </div>
          <div className={`banner ${resultText ? 'show' : ''}`} role="status">{resultText ?? ' '}</div>
        </main>

        <aside className="col">
          {(['w', 'b'] as const).map((c) => (
            <section className={`card player ${chass.activeClock === c ? 'active' : ''}`} key={c}>
              <div className="phead">
                <h2>{c === 'w' ? 'White' : 'Black'} Player</h2>
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

          <section className="card">
            <h2>Instructions</h2>
            <div className="instr">
              <p><b>Standard Chess:</b> Click a piece, then a highlighted square. Captures may trigger a gag. Click or press Esc to skip it.</p>
              {game.variants.map((v) => (
                <p key={v.id}><b>{v.name}:</b> {v.blurb}</p>
              ))}
            </div>
          </section>

          <section className="card">
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
