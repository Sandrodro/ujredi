import { describe, expect, it } from 'vitest'
import { TIERS, blackCount, checkGrid } from './rules'
import { SAMPLE_GRIDS } from './samples'

describe('SAMPLE_GRIDS', () => {
  it('has 3 grids for each tier', () => {
    for (const tier of ['standard', 'loose'] as const) {
      expect(SAMPLE_GRIDS.filter((grid) => grid.tier === tier)).toHaveLength(3)
    }
  })

  it('has 13x13 grids only', () => {
    expect(SAMPLE_GRIDS.every((grid) => grid.rows.length === 13)).toBe(true)
  })

  it.each(SAMPLE_GRIDS)('$id follows the rules of its tier', ({ rows, tier }) => {
    expect(checkGrid(rows, tier)).toEqual([])
    const { min, max } = TIERS[tier]
    expect(blackCount(rows)).toBeGreaterThanOrEqual(min)
    expect(blackCount(rows)).toBeLessThanOrEqual(max)
  })

  it('has unique ids', () => {
    expect(new Set(SAMPLE_GRIDS.map((grid) => grid.id)).size).toBe(SAMPLE_GRIDS.length)
  })
})
