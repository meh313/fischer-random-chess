import { useEffect, useRef, type CSSProperties } from 'react'
import type { ActiveMeme } from './useMemes'

interface Props {
  meme: ActiveMeme
  /** Where the square sits on the board as displayed (percent left/top). */
  pos: CSSProperties
  onDone: () => void
}

/** Short clips freeze on their last frame until this much time has passed, so they are seen but never loop. */
const MIN_MS = 900

/** A reaction clip filling one board square: no text, played once, then gone. */
export function MemeFlash({ meme, pos, onDone }: Props) {
  const started = useRef(performance.now())
  const hold = useRef(0)
  useEffect(() => () => clearTimeout(hold.current), [])
  const ended = () => {
    const left = MIN_MS - (performance.now() - started.current)
    if (left > 0) hold.current = window.setTimeout(onDone, left)
    else onDone()
  }
  const credit = meme.gif ? `${meme.gif.title || 'GIF'}${meme.gif.user ? ` by ${meme.gif.user}` : ''}, via GIPHY` : undefined
  return (
    <div className="meme-flash" style={pos} aria-hidden="true" title={credit}>
      {meme.video ? (
        <video src={meme.src} autoPlay muted playsInline onEnded={ended} onError={onDone} />
      ) : (
        <img src={meme.src} alt="" draggable={false} onError={onDone} />
      )}
    </div>
  )
}
