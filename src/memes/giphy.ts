/**
 * Minimal GIPHY search client. Per GIPHY's API rules: calls go straight from the browser,
 * responses and media are not cached or stored by us, returned URLs are used unmodified,
 * and anything shown carries "Powered by GIPHY" plus the creator when known.
 */

export interface GifHit {
  id: string
  title: string
  /** MP4 rendition URL exactly as GIPHY returned it (video plays once, a GIF file would loop forever). */
  src: string
  width: number
  height: number
  /** GIPHY page for the GIF (attribution link). */
  page: string
  /** Creator's display name or username, when GIPHY has one. */
  user?: string
}

interface Rendition {
  url?: string
  mp4?: string
  frames?: string
  width?: string
  height?: string
}

interface RawGif {
  id: string
  title?: string
  url?: string
  username?: string
  user?: { display_name?: string; username?: string }
  images?: Record<string, Rendition | undefined>
}

/** About one second of animation at typical GIF frame rates. */
export const MIN_FRAMES = 12

export const giphyKey = (): string => (import.meta.env.VITE_GIPHY_KEY as string | undefined)?.trim() ?? ''

/** Turns a search response into usable hits, skipping blocked ids and entries without media. */
export function parseSearch(json: unknown, blocked: readonly string[] = []): GifHit[] {
  const data = (json as { data?: RawGif[] } | null)?.data
  if (!Array.isArray(data)) return []
  const out: GifHit[] = []
  for (const g of data) {
    if (!g?.id || blocked.includes(g.id)) continue
    // Tiny loops (a few frames) are over before anyone sees them when played once.
    const frames = Number(g.images?.original?.frames)
    if (frames && frames < MIN_FRAMES) continue
    const r = g.images?.fixed_height?.mp4 ? g.images.fixed_height : g.images?.fixed_width
    const src = r?.mp4
    if (!src) continue
    const user = g.user?.display_name || g.user?.username || g.username || undefined
    out.push({ id: g.id, title: g.title ?? '', src, width: Number(r?.width) || 200, height: Number(r?.height) || 200, page: g.url ?? 'https://giphy.com', user })
  }
  return out
}

export interface SearchOptions {
  key: string
  rating: string
  blocked?: readonly string[]
  signal?: AbortSignal
  rand?: () => number
  fetchImpl?: typeof fetch
}

/** Searches GIPHY and returns one random hit from the first page, or null. */
export async function searchGif(query: string, o: SearchOptions): Promise<GifHit | null> {
  const params = new URLSearchParams({ api_key: o.key, q: query, limit: '25', rating: o.rating, lang: 'en', bundle: 'messaging_non_clips' })
  const res = await (o.fetchImpl ?? fetch)(`https://api.giphy.com/v1/gifs/search?${params}`, { signal: o.signal })
  if (!res.ok) throw new Error(`GIPHY HTTP ${res.status}`)
  const hits = parseSearch(await res.json(), o.blocked)
  if (!hits.length) return null
  return hits[Math.floor((o.rand ?? Math.random)() * hits.length)] ?? null
}

/** Resolves once the clip can play through, or rejects after `ms` so a slow GIF never delays the game. */
export function preload(src: string, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    const done = (ok: boolean) => {
      clearTimeout(t)
      v.oncanplaythrough = v.onerror = null
      if (!ok) v.removeAttribute('src')
      if (ok) resolve()
      else reject(new Error('GIF failed to load in time'))
    }
    const t = window.setTimeout(() => done(false), ms)
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    v.oncanplaythrough = () => done(true)
    v.onerror = () => done(false)
    v.src = src
    v.load()
  })
}
