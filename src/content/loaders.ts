import type { Cinematic, MemeEntry, MemeFile, PieceSetFile, ResolvedPieceSet } from './types'
import { validateCinematicsReport } from './select'

export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(asset(path))
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  return (await res.json()) as T
}

export async function loadCinematics(): Promise<{ items: Cinematic[]; problems: string[] }> {
  return validateCinematicsReport(await getJson('cinematics/cinematics.json'))
}

export async function loadMemes(): Promise<MemeEntry[]> {
  const file = await getJson<MemeFile>('memes/memes.json')
  if (file.version !== 1 || !Array.isArray(file.memes)) throw new Error('memes.json: expected {version:1, memes:[...]}')
  return file.memes
}

export async function loadPieceSetIndex(): Promise<{ id: string; name: string; placeholder?: boolean }[]> {
  const ids = await getJson<string[]>('piecesets/index.json')
  // One broken pack must not hide the others.
  const results = await Promise.allSettled(ids.map((id) => getJson<PieceSetFile>(`piecesets/${id}/set.json`)))
  return results.flatMap((r) => (r.status === 'fulfilled' ? [{ id: r.value.id, name: r.value.name, placeholder: r.value.placeholder }] : []))
}

/** Loads a set, following `extends` so a pack can override only some pieces. */
export async function loadPieceSet(id: string, depth = 0): Promise<ResolvedPieceSet> {
  if (depth > 4) throw new Error(`Piece set "${id}": extends chain too deep`)
  const file = await getJson<PieceSetFile>(`piecesets/${id}/set.json`)
  const base = file.extends ? await loadPieceSet(file.extends, depth + 1) : undefined
  const art: ResolvedPieceSet['art'] = { ...(base?.art ?? {}) }
  for (const [key, def] of Object.entries(file.pieces)) {
    const poses: Record<string, string> = { idle: asset(`piecesets/${id}/${def.img}`) }
    for (const [pose, img] of Object.entries(def.poses ?? {})) poses[pose] = asset(`piecesets/${id}/${img}`)
    art[key] = poses
  }
  return { id: file.id, name: file.name, description: file.description, placeholder: file.placeholder, art }
}
