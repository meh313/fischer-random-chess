import type { State } from '../engine/types'
import type { AiRequest, AiResponse } from './ai.worker'
import type { AiAction, AiLevel } from './search'

/** Talks to the AI web worker. One request at a time; cancel() drops the current one. */
export class AiClient {
  private worker: Worker | null = null
  private seq = 0
  private pending = new Map<number, { resolve: (a: AiAction) => void; reject: (e: Error) => void }>()

  private ensure(): Worker {
    if (!this.worker) {
      const w = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' })
      w.onmessage = (e: MessageEvent<AiResponse>) => {
        const p = this.pending.get(e.data.id)
        if (!p) return
        this.pending.delete(e.data.id)
        if (e.data.action) p.resolve(e.data.action)
        else p.reject(new Error(e.data.error ?? 'AI failed'))
      }
      this.worker = w
    }
    return this.worker
  }

  think(state: State, variants: readonly string[], level: AiLevel): Promise<AiAction> {
    return new Promise((resolve, reject) => {
      const id = ++this.seq
      this.pending.set(id, { resolve, reject })
      const req: AiRequest = { id, state, variants: [...variants], level }
      this.ensure().postMessage(req)
    })
  }

  cancel() {
    for (const p of this.pending.values()) p.reject(new Error('cancelled'))
    this.pending.clear()
    this.worker?.terminate()
    this.worker = null
  }
}
