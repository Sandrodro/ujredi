import { describe, expect, it } from 'vitest'
import { findEntries } from './entries'

// 3x3 with a black center. Numbered cells:
//   1 . 2
//   . # .
//   3 . .
const rows = ['...', '.#.', '...']

describe('findEntries', () => {
  const { entries, numbers } = findEntries(rows)

  it('numbers the cells that start a word', () => {
    expect(numbers.get('0,0')).toBe(1)
    expect(numbers.get('0,2')).toBe(2)
    expect(numbers.get('2,0')).toBe(3)
    expect(numbers.size).toBe(3)
  })

  it('lists across and down entries with their cells', () => {
    const across1 = entries.find((e) => e.number === 1 && e.direction === 'across')
    expect(across1?.cells).toEqual([[0, 0], [0, 1], [0, 2]])
    const down2 = entries.find((e) => e.number === 2 && e.direction === 'down')
    expect(down2?.cells).toEqual([[0, 2], [1, 2], [2, 2]])
  })

  it('has no across entry for a cell that only starts a down word', () => {
    expect(entries.find((e) => e.number === 2 && e.direction === 'across')).toBeUndefined()
  })

  it('returns 4 entries', () => {
    expect(entries).toHaveLength(4)
  })
})
