import type { ActiveMeme } from './useMemes'

interface Props {
  meme: ActiveMeme | null
  muted: boolean
  volume: number
  onDismiss: () => void
}

/** Shows one image, GIF or short video over the board. Click to dismiss. */
export function MemeOverlay({ meme, muted, volume, onDismiss }: Props) {
  if (!meme) return null
  const { src, ms, gif, caption } = meme
  return (
    <div className="meme-overlay" key={meme.key} onClick={onDismiss} style={{ animationDuration: `${ms}ms` }}>
      <div className={gif ? 'meme-card gif' : 'meme-card'}>
        {meme.video ? (
          <video ref={(v) => { if (v) v.volume = Math.min(1, Math.max(0, volume)) }} src={src} autoPlay muted={muted} playsInline loop />
        ) : (
          <img src={src} alt={gif?.title || caption || 'meme'} draggable={false} />
        )}
        {meme.placeholder && <span className="meme-tag">PLACEHOLDER</span>}
        {caption && <div className="meme-caption">{caption}</div>}
        {gif && (
          <a className="giphy-credit" href={gif.page} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            Powered by GIPHY{gif.user ? ` · ${gif.user}` : ''}
          </a>
        )}
      </div>
    </div>
  )
}
