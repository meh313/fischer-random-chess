import { TIME_CONTROLS, useSettings } from '../state/settings'

interface Props {
  open: boolean
  onClose: () => void
  pieceSets: { id: string; name: string; placeholder?: boolean }[]
}

function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="row">
      <div>
        <div className="label">{label}</div>
        {hint && <div className="hint">{hint}</div>}
      </div>
      <label className="switch" htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span />
      </label>
    </div>
  )
}

function Slider({ label, value, min, max, step, fmt, onChange }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div className="row slider">
      <div className="label">{label}</div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
      <span className="val">{fmt(value)}</span>
    </div>
  )
}

export function SettingsPanel({ open, onClose, pieceSets }: Props) {
  const { settings: s, update, reset } = useSettings()
  if (!open) return null
  const pct = (v: number) => `${Math.round(v * 100)}%`
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-box" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="btn small" onClick={onClose}>Close</button>
        </div>

        <h3>Gags</h3>
        <Toggle id="set-cine" label="Capture cinematics" hint="Short scripted gags when a piece is captured" checked={s.cinematics} onChange={(v) => update({ cinematics: v })} />
        <Slider label="Cinematic frequency" value={s.cinematicChance} min={0} max={1} step={0.05} fmt={pct} onChange={(v) => update({ cinematicChance: v })} />
        <Toggle id="set-aim" label="Aim mode" hint="A gun hand points at your attacked, undefended pieces" checked={s.aimMode} onChange={(v) => update({ aimMode: v })} />
        <Toggle id="set-memes" label="Meme overlays" hint="Image, GIF or video pop-ups on big moments" checked={s.memes} onChange={(v) => update({ memes: v })} />
        <Slider label="Meme frequency" value={s.memeChance} min={0} max={1} step={0.05} fmt={pct} onChange={(v) => update({ memeChance: v })} />
        <Slider label="Meme cooldown" value={s.memeCooldownSec} min={0} max={60} step={5} fmt={(v) => `${v}s`} onChange={(v) => update({ memeCooldownSec: v })} />

        <h3>Sound</h3>
        <Toggle id="set-sound" label="Sound" checked={s.sound} onChange={(v) => update({ sound: v })} />
        <Slider label="Volume" value={s.volume} min={0} max={1} step={0.05} fmt={pct} onChange={(v) => update({ volume: v })} />

        <h3>Pieces and clock</h3>
        <div className="row">
          <div className="label">Piece set</div>
          <select value={s.pieceSet} onChange={(e) => update({ pieceSet: e.target.value })} aria-label="Piece set">
            {pieceSets.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.placeholder ? ' (placeholder art)' : ''}</option>
            ))}
          </select>
        </div>
        <div className="row">
          <div>
            <div className="label">Time control</div>
            <div className="hint">Applies to the next new game</div>
          </div>
          <select value={s.timeControl} onChange={(e) => update({ timeControl: e.target.value })} aria-label="Time control">
            {TIME_CONTROLS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="modal-foot">
          <button className="btn small" onClick={reset}>Reset to defaults</button>
        </div>
      </div>
    </div>
  )
}
