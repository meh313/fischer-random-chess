import { asset } from '../content/loaders'
import type { ActiveMeme } from './useMemes'

const VIDEO = /\.(mp4|webm|ogv)$/i

interface Props {
  meme: ActiveMeme | null
  muted: boolean
  volume: number
  onDismiss: () => void
}

/** Shows one image, GIF or short video over the board. Click to dismiss. */
export function MemeOverlay({ meme, muted, volume, onDismiss }: Props) {
  if (!meme) return null
  const { entry, ms } = meme
  const src = asset(`memes/${entry.media}`)
  return (
    <div className="meme-overlay" key={meme.key} onClick={onDismiss} style={{ animationDuration: `${ms}ms` }}>
      <div className="meme-card">
        {VIDEO.test(entry.media) ? (
          <video ref={(v) => { if (v) v.volume = Math.min(1, Math.max(0, volume)) }} src={src} autoPlay muted={muted} playsInline loop />
        ) : (
          <img src={src} alt={entry.caption ?? entry.id} draggable={false} />
        )}
        {entry.placeholder && <span className="meme-tag">PLACEHOLDER</span>}
        {entry.caption && <div className="meme-caption">{entry.caption}</div>}
      </div>
    </div>
  )
}
