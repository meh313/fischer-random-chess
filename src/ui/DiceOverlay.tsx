import { useEffect, useRef, useState } from 'react'
import { VARIANTS } from '../engine'
import { playSfx } from '../audio/sfx'

interface Props {
  /** The variants the dice landed on. */
  ids: readonly string[]
  seed: number
  onDone: () => void
}

const SPIN_MS = 1100
const HOLD_MS = 900

/** Slot-machine style roll: names flicker, then the result locks in. Skippable by click or Esc. */
export function DiceOverlay({ ids, seed, onDone }: Props) {
  const names = Object.values(VARIANTS).map((v) => v.name)
  const finalText = ids.map((id) => VARIANTS[id]?.name ?? id).join(' + ')
  const reduced = typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  const [text, setText] = useState(reduced ? finalText : names[0] ?? '')
  const [landed, setLanded] = useState(reduced)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    let i = 0
    const timers: number[] = []
    if (!reduced) {
      void playSfx('dice')
      const flicker = window.setInterval(() => {
        i = (i + 1 + Math.floor(Math.random() * 2)) % names.length
        setText(names[i] ?? '')
      }, 85)
      timers.push(
        window.setTimeout(() => {
          clearInterval(flicker)
          setText(finalText)
          setLanded(true)
        }, SPIN_MS),
      )
      timers.push(window.setTimeout(() => doneRef.current(), SPIN_MS + HOLD_MS))
      return () => {
        clearInterval(flicker)
        timers.forEach(clearTimeout)
      }
    }
    timers.push(window.setTimeout(() => doneRef.current(), HOLD_MS))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="dice-overlay" role="status" aria-live="polite" onClick={() => doneRef.current()}>
      <div className={`dice-card ${landed ? 'landed' : ''}`}>
        <div className="dice-title">Chaos Dice</div>
        <div className="dice-result" aria-label={landed ? `Rolled: ${finalText}` : 'Rolling'}>
          {text}
        </div>
        <div className="dice-seed">seed {seed}</div>
      </div>
    </div>
  )
}
