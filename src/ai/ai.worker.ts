import { resolveVariants } from '../engine/variants'
import type { State } from '../engine/types'
import { chooseAction, LEVELS, type AiAction, type AiLevel } from './search'

export interface AiRequest {
  id: number
  state: State
  variants: string[]
  level: AiLevel
}
export interface AiResponse {
  id: number
  action?: AiAction
  error?: string
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<AiRequest>) => void) | null
  postMessage: (msg: AiResponse) => void
}

// Search runs here so the board never freezes while the AI thinks.
scope.onmessage = (e) => {
  const { id, state, variants, level } = e.data
  try {
    scope.postMessage({ id, action: chooseAction(state, resolveVariants(variants), LEVELS[level]) })
  } catch (err) {
    scope.postMessage({ id, error: (err as Error).message })
  }
}
