import type { State } from '../engine/types'
import type { AiRequest, AiResponse } from './ai.worker'
import type { AiAction, AiLevel } from './search'

/** Talks to the AI web worker. One request at a time. Failures reject, so the caller can fall back. */
export class AiClient {
  private worker: Worker | null = null
  private seq = 0
  private pending = new Map<number, { resolve: (a: AiAction) => void; reject: (e: Error) => void }>()

  private failAll(message: string) {
    const all = [...this.pending.values()]
    this.pending.clear()
    for (const p of all) p.reject(new Error(message))
  }

  private ensure(): Worker {
    if (!this.worker) {
      const w = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' })
      w.onmessage = (e: MessageEvent<AiResponse>) => {
        const p = this.pending.get(e.data.id)
        if (!p) return // answer to a request that was cancelled
        this.pending.delete(e.data.id)
        if (e.data.action) p.resolve(e.data.action)
        else p.reject(new Error(e.data.error ?? 'AI failed'))
      }
      // A load failure or crash must never leave the game waiting forever.
      w.onerror = (e) => {
        this.dispose()
        this.failAll(e.message || 'AI worker error')
      }
      w.onmessageerror = () => {
        this.dispose()
        this.failAll('AI worker message error')
      }
      this.worker = w
    }
    return this.worker
  }

  think(state: State, variants: readonly string[], level: AiLevel, seen: [string, number][] = []): Promise<AiAction> {
    return new Promise((resolve, reject) => {
      const id = ++this.seq
      this.pending.set(id, { resolve, reject })
      const req: AiRequest = { id, state, variants: [...variants], level, seen }
      try {
        this.ensure().postMessage(req)
      } catch (err) {
        this.pending.delete(id)
        reject(err as Error)
      }
    })
  }

  /** Drop the current request. A search in flight cannot be interrupted, so that worker is replaced. */
  cancel() {
    if (this.pending.size === 0) return
    this.failAll('cancelled')
    this.dispose()
  }

  dispose() {
    this.worker?.terminate()
    this.worker = null
  }
}
