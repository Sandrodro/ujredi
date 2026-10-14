import { describe, expect, it } from 'vitest'
import { blackCount, checkGrid } from './rules'

// A valid 13x13 grid. Tests break one rule at a time.
const valid13 = [
  '#...#...#...#',
  '........#....',
  '.............',
  '.......#.....',
  '##....##.....',
  '#...#....#...',
  '...##...##...',
  '...#....#...#',
  '.....##....##',
  '.....#.......',
  '.............',
  '....#........',
  '#...#...#...#',
]

const blank = (size: number) =>
  Array.from({ length: size }, () => '.'.repeat(size))

const setCell = (rows: string[], row: number, col: number, ch: string) =>
  rows.map((line, r) =>
    r === row ? line.slice(0, col) + ch + line.slice(col + 1) : line,
  )

describe('checkGrid', () => {
  it('accepts a valid grid', () => {
    expect(checkGrid(valid13)).toEqual([])
  })

  it('rejects an unsupported size', () => {
    expect(checkGrid(blank(11))).toContainEqual(expect.stringMatching(/size/i))
    expect(checkGrid(blank(15))).toContainEqual(expect.stringMatching(/size/i))
  })

  it('rejects a grid that is not square', () => {
    const rows = valid13.map((line, i) => (i === 0 ? line + '.' : line))
    expect(checkGrid(rows)).toContainEqual(expect.stringMatching(/square/i))
  })

  it('rejects a grid without rotational symmetry', () => {
    const rows = setCell(valid13, 0, 1, '#')
    expect(checkGrid(rows)).toContainEqual(expect.stringMatching(/symmetr/i))
  })

  it('rejects a black count above the hard ceiling', () => {
    // Alternate black cells in a symmetric pattern: 85 of 169 are black.
    const rows = Array.from({ length: 13 }, (_, r) =>
      Array.from({ length: 13 }, (_, c) => ((r + c) % 2 === 0 ? '#' : '.')).join(''),
    )
    expect(checkGrid(rows)).toContainEqual(expect.stringMatching(/black/i))
  })

  it('rejects a solid 3x3 black block', () => {
    let rows = blank(13)
    for (const [r, c] of [
      [5, 5], [5, 6], [5, 7],
      [6, 5], [6, 6], [6, 7],
      [7, 5], [7, 6], [7, 7],
    ]) {
      rows = setCell(rows, r, c, '#')
    }
    expect(checkGrid(rows)).toContainEqual(expect.stringMatching(/3x3/i))
  })

  it('rejects a word shorter than 3 cells', () => {
    // Black at (0,2) and its twin (12,10) leave a 2-cell run in row 0.
    const rows = setCell(setCell(blank(13), 0, 2, '#'), 12, 10, '#')
    expect(checkGrid(rows)).toContainEqual(expect.stringMatching(/short/i))
  })

  it('rejects white cells that are not connected', () => {
    // A black ring around the center splits the grid in two.
    let rows = blank(13)
    for (let i = 4; i <= 8; i++) {
      for (const [r, c] of [[4, i], [8, i], [i, 4], [i, 8]]) {
        rows = setCell(rows, r, c, '#')
      }
    }
    expect(checkGrid(rows)).toContainEqual(expect.stringMatching(/connected/i))
  })
})

describe('tiers', () => {
  it('uses the ceiling of the tier', () => {
    // 85 black cells in a checkerboard is above both ceilings.
    const rows = Array.from({ length: 13 }, (_, r) =>
      Array.from({ length: 13 }, (_, c) => ((r + c) % 2 === 0 ? '#' : '.')).join(''),
    )
    expect(checkGrid(rows, 'standard')).toContainEqual(expect.stringMatching(/ceiling of 34/))
    expect(checkGrid(rows, 'loose')).toContainEqual(expect.stringMatching(/ceiling of 46/))
  })

  it('rejects a word longer than the tier maximum', () => {
    // valid13 has 13-letter words, which are fine in standard and not in loose.
    expect(checkGrid(valid13, 'standard')).toEqual([])
    expect(checkGrid(valid13, 'loose')).toContainEqual(expect.stringMatching(/longer than 9/i))
  })
})

describe('blackCount', () => {
  it('counts # cells', () => {
    expect(blackCount(['#.#', '...', '#.#'])).toBe(4)
  })
})
