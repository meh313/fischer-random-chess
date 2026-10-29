import type { ReplayState } from '../state/useChass'

interface Props {
  replay: ReplayState
  autoplay: boolean
  onAutoplay: (on: boolean) => void
  onBack: () => void
  onForward: () => void
  onJump: (index: number) => void
  onPlayFromHere: () => void
}

/** Controls for stepping through a loaded game. The board animates each step and plays the gags. */
export function ReplayBar({ replay, autoplay, onAutoplay, onBack, onForward, onJump, onPlayFromHere }: Props) {
  const total = replay.actions.length
  const atEnd = replay.cursor >= total
  return (
    <div className="replaybar" role="group" aria-label="Replay controls">
      <div className="replay-title">
        Replay: <b>{replay.title}</b>
        <span className="replay-pos" aria-live="polite">
          {replay.cursor} / {total}
        </span>
      </div>
      <div className="replay-buttons">
        <button className="btn small" onClick={() => onJump(0)} disabled={replay.cursor === 0} aria-label="Go to the start">
          |&lt;
        </button>
        <button className="btn small" onClick={onBack} disabled={replay.cursor === 0} aria-label="Step back">
          &lt;
        </button>
        <button className="btn small" onClick={() => onAutoplay(!autoplay)} disabled={atEnd} aria-pressed={autoplay}>
          {autoplay ? 'Pause' : 'Play'}
        </button>
        <button className="btn small" onClick={onForward} disabled={atEnd} aria-label="Step forward">
          &gt;
        </button>
        <button className="btn small" onClick={() => onJump(total)} disabled={atEnd} aria-label="Go to the end">
          &gt;|
        </button>
        <button className="btn small primary" onClick={onPlayFromHere}>
          Play from here
        </button>
      </div>
    </div>
  )
}
