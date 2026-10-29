import { useEffect, useRef, useState } from 'react'
import { useModal } from './useModal'

interface Props {
  open: boolean
  onClose: () => void
  /** PGN of the game on the board. */
  current: string
  /** Returns an error message, or null when the game loaded. */
  onImport: (text: string) => string | null
}

/** Export the current game as PGN, or paste / open a PGN file to replay it. */
export function PgnDialog({ open, onClose, current, onImport }: Props) {
  const boxRef = useModal<HTMLDivElement>(open, onClose)
  const [text, setText] = useState(current)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setText(current)
      setError(null)
      setCopied(false)
    }
    // Only reset when the dialog opens, not on every move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('Copy was blocked by the browser. Select the text and copy it by hand.')
    }
  }

  const download = () => {
    const blob = new Blob([text], { type: 'application/x-chess-pgn' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const d = new Date()
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
    a.href = url
    a.download = `chass-${stamp}.pgn`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const openFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 2_000_000) {
      setError('That file is too large for a PGN (over 2 MB).')
      return
    }
    setText(await file.text())
    setError(null)
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-box pgn-box" ref={boxRef} role="dialog" aria-modal="true" aria-label="PGN export and import" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>PGN</h2>
          <button className="btn small" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="hint">
          This is the game on the board. Copy or download it, or paste or open another PGN and press Replay it. Chass variants and duck placements are kept in the file.
        </p>
        <textarea className="pgn-text" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label="PGN text" rows={12} />
        {error && (
          <div className="pgn-error" role="alert">
            {error}
          </div>
        )}
        <div className="pgn-actions">
          <button className="btn small" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button className="btn small" onClick={download}>
            Download
          </button>
          <button className="btn small" onClick={() => fileRef.current?.click()}>
            Open file
          </button>
          <input ref={fileRef} type="file" accept=".pgn,.txt,text/plain" hidden onChange={(e) => void openFile(e.target.files?.[0])} />
          <button
            className="btn small primary"
            onClick={() => {
              const err = onImport(text)
              setError(err)
            }}
          >
            Replay it
          </button>
        </div>
      </div>
    </div>
  )
}
