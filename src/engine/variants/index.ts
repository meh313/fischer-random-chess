import type { Variant } from '../variant'
import { dragonBishop } from './dragonBishop'
import { duck } from './duck'
import { fischer960 } from './fischer960'

/** Register a new variant here. Nothing else in the engine needs to change. */
export const VARIANTS: Record<string, Variant> = {
  [fischer960.id]: fischer960,
  [dragonBishop.id]: dragonBishop,
  [duck.id]: duck,
}

export function resolveVariants(ids: readonly string[]): Variant[] {
  const list = [...new Set(ids)].map((id) => {
    const v = Object.hasOwn(VARIANTS, id) ? VARIANTS[id] : undefined
    if (!v) throw new Error(`Unknown variant: ${id}`)
    return v
  })
  for (const v of list) {
    for (const other of v.conflictsWith ?? []) {
      if (ids.includes(other)) throw new Error(`Variants ${v.id} and ${other} conflict`)
    }
  }
  return list
}
