import { describe, expect, it } from 'vitest'
import { TIERS, blackCount, checkGrid } from './rules'
import { SAMPLE_GRIDS } from './samples'

describe('SAMPLE_GRIDS', () => {
  it('has 1 grid in each of loose, open, loose-14 and open-14, and 2 in each long tier', () => {
    const count = (tier: string) => SAMPLE_GRIDS.filter((grid) => grid.tier === tier).length
    expect(
      [count('loose'), count('open'), count('loose-14'), count('open-14'), count('loose-long'), count('open-long')],
    ).toEqual([1, 1, 1, 1, 2, 2])
  })

  it('has the black count of its name', () => {
    for (const grid of SAMPLE_GRIDS.filter(({ tier }) => tier === 'loose' || tier === 'open')) {
      expect(blackCount(grid.rows)).toBe(grid.tier === 'loose' ? 36 : 34)
    }
  })

  it('has the size of its tier', () => {
    expect(SAMPLE_GRIDS.every((grid) => grid.rows.length === TIERS[grid.tier].size)).toBe(true)
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
