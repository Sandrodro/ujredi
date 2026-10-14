import { describe, expect, it } from 'vitest'
import { findEntries } from '../grids/entries'
import type { Letters } from '../grids/fill'
import { SAMPLE_GRIDS } from '../grids/samples'
import { buildPuzzle, isComplete, puzzleFileName } from './build'

// Four words: 1 across, 1 down, 2 down, 3 across.
//   . . .
//   . # .
//   . . .
const grid = ['...', '.#.', '...']
const base = {
  id: 'id-1',
  title: ' Test ',
  author: '',
  gridRows: grid,
  letters: {} as Letters,
  clues: {},
  savedAt: '2026-10-14T22:00:00.000Z',
}

describe('buildPuzzle', () => {
  it('builds one clue per word, with the answer from the rows', () => {
    const letters = { '0,0': 'ა', '0,1': 'ბ', '0,2': 'გ', '1,0': 'დ', '2,0': 'ე', '1,2': 'ვ', '2,2': 'ზ' }
    const puzzle = buildPuzzle({ ...base, letters, clues: { '1-across': ' პირველი ' } })

    expect(puzzle.rows).toEqual([
      ['ა', 'ბ', 'გ'],
      ['დ', null, 'ვ'],
      ['ე', '', 'ზ'],
    ])
    expect(puzzle.clues).toEqual([
      { number: 1, direction: 'across', answer: 'აბგ', question: 'პირველი' },
      { number: 1, direction: 'down', answer: 'ადე', question: '' },
      { number: 2, direction: 'down', answer: 'გვზ', question: '' },
      { number: 3, direction: 'across', answer: 'ეზ', question: '' },
    ])
  })

  it('stores Latin letters, symbols and emojis as typed, one cell each', () => {
    const family = '👨‍👩‍👧'
    const letters = { '0,0': 'a', '0,1': '@', '0,2': '😀', '1,0': '#', '2,0': '.', '1,2': family }
    const puzzle = buildPuzzle({ ...base, letters })

    expect(puzzle.rows).toEqual([
      ['a', '@', '😀'],
      ['#', null, family],
      ['.', '', ''],
    ])
    expect(puzzle.clues[0].answer).toBe('a@😀')
    expect(puzzle.clues[1].answer).toBe('a#.')
  })

  it('trims the title and leaves out an empty author', () => {
    const puzzle = buildPuzzle(base)
    expect(puzzle.title).toBe('Test')
    expect('author' in puzzle).toBe(false)
    expect(buildPuzzle({ ...base, author: ' Nino ' }).author).toBe('Nino')
  })

  it('has the fields of schema version 2 and nothing else', () => {
    expect(Object.keys(buildPuzzle(base)).sort()).toEqual(
      ['clues', 'id', 'rows', 'savedAt', 'schemaVersion', 'size', 'title'].sort(),
    )
    expect(buildPuzzle(base).schemaVersion).toBe(2)
    expect(buildPuzzle(base).size).toBe(3)
  })

  it('fails without a title', () => {
    expect(() => buildPuzzle({ ...base, title: '   ' })).toThrow(/title/)
  })

  it('builds a valid puzzle from a real sample grid', () => {
    const sample = SAMPLE_GRIDS[0]
    const { entries } = findEntries(sample.rows)
    const alphabet = [...'აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ']
    const letters: Letters = {}
    sample.rows.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if (ch !== '#') letters[`${r},${c}`] = alphabet[(r * 13 + c) % alphabet.length]
      }),
    )
    const puzzle = buildPuzzle({ ...base, gridRows: sample.rows, letters })

    expect(puzzle.size).toBe(13)
    expect(puzzle.clues).toHaveLength(entries.length)
    // Black cells are where the grid has them, and no cell is empty.
    expect(puzzle.rows.map((row) => row.map((cell) => (cell === null ? '#' : '.')).join(''))).toEqual(
      sample.rows.map((row) => row.replace(/[^#]/g, '.')),
    )
    expect(puzzle.rows.flat().includes('')).toBe(false)
    // Every answer is the word's cells in rows.
    entries.forEach((entry, i) => {
      expect(puzzle.clues[i].answer).toBe(entry.cells.map(([r, c]) => puzzle.rows[r][c]).join(''))
    })
  })
})

describe('isComplete', () => {
  const letters: Letters = {
    '0,0': 'ა', '0,1': 'ბ', '0,2': 'გ', '1,0': 'დ', '1,2': 'ვ', '2,0': 'ე', '2,1': 'ზ', '2,2': 'თ',
  }
  const allClues = { '1-across': 'a', '1-down': 'b', '2-down': 'c', '3-across': 'd' }

  it('is true when every cell has a letter and every word has a clue', () => {
    expect(isComplete(buildPuzzle({ ...base, letters, clues: allClues }))).toBe(true)
  })

  it('is true for cells with other characters', () => {
    const mixed = { ...letters, '0,0': '😀', '0,1': '@' }
    expect(isComplete(buildPuzzle({ ...base, letters: mixed, clues: allClues }))).toBe(true)
  })

  it('is false with an empty cell', () => {
    const { '2,2': _removed, ...fewer } = letters
    expect(isComplete(buildPuzzle({ ...base, letters: fewer, clues: allClues }))).toBe(false)
  })

  it('is false with a missing clue', () => {
    const { '3-across': _removed, ...fewer } = allClues
    expect(isComplete(buildPuzzle({ ...base, letters, clues: fewer }))).toBe(false)
  })
})

describe('puzzleFileName', () => {
  it('keeps Georgian letters and adds .json', () => {
    expect(puzzleFileName('კვირის კროსვორდი')).toBe('კვირის კროსვორდი.json')
  })

  it('removes characters that are not safe in a file name', () => {
    expect(puzzleFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij.json')
  })

  it('falls back to crossword.json', () => {
    expect(puzzleFileName('  /// ')).toBe('crossword.json')
    expect(puzzleFileName('')).toBe('crossword.json')
  })
})
