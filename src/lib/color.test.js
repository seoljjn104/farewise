import { describe, it, expect } from 'vitest'
import { contrastRatio } from './color.js'

describe('contrastRatio', () => {
  it('returns 21 for black on white', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1)
  })

  it('is symmetric', () => {
    expect(contrastRatio('#8492a3', '#0e1319')).toBeCloseTo(
      contrastRatio('#0e1319', '#8492a3'),
      5
    )
  })

  it('keeps muted text readable on every surface', () => {
    expect(contrastRatio('#8492a3', '#0e1319')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#8492a3', '#12171f')).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps faint text readable on every surface', () => {
    expect(contrastRatio('#7b8998', '#0e1319')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#7b8998', '#0a0e13')).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the accents readable', () => {
    expect(contrastRatio('#ffc42e', '#0e1319')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#3ddc97', '#0e1319')).toBeGreaterThanOrEqual(4.5)
  })
})
