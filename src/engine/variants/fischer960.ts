import { chess960Fen } from '../fen'
import type { Variant } from '../variant'

export const fischer960: Variant = {
  id: 'fischer960',
  name: 'Fischer Random',
  blurb: 'Chess960: shuffled back rank, bishops on opposite colors, king between the rooks.',
  setupFen: (rng) => chess960Fen(rng),
}
