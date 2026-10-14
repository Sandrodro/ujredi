import { describe, expect, it } from 'vitest'
import { buildPuzzle } from './build'
import { draftFromPuzzle, type Draft } from './draft'
import type { PuzzleV1 } from './types'

// Fixed on purpose, so the tests do not change when the sample grids do.
const layout = [
  '##....#.....#',
  '......#......',
  '.............',
  '...##...##...',
  '#...#...#....',
  '#......#.....',
  '.............',
  '.....#......#',
  '....#...#...#',
  '...##...##...',
  '.............',
  '......#......',
  '#.....#....##',
]
const savedAt = '2026-10-14T22:00:00.000Z'

// A letter for every white cell, cycling through the alphabet.
const alphabet = [...'აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ']
const allLetters: Draft['letters'] = {}
layout.forEach((row, r) =>
  [...row].forEach((ch, c) => {
    if (ch !== '#') allLetters[`${r},${c}`] = alphabet[(r * 13 + c) % alphabet.length]
  }),
)

const build = (draft: Draft, gridRows = layout) =>
  buildPuzzle({
    id: draft.puzzleId ?? 'id-1',
    title: draft.title,
    author: draft.author,
    gridRows,
    letters: draft.letters,
    clues: draft.clues,
    savedAt,
  })

describe('draftFromPuzzle', () => {
  it('gives back the same puzzle after a save and an open', () => {
    const draft: Draft = {
      letters: allLetters,
      clues: { '1-across': 'პირველი', '2-down': 'მეორე' },
      title: 'კვირის კროსვორდი',
      author: 'ნინო',
      puzzleId: 'id-1',
      generated: [],
    }
    const saved = build(draft)

    const opened = draftFromPuzzle(JSON.parse(JSON.stringify(saved)))

    expect(opened.gridRows).toEqual(layout)
    expect(opened.draft).toEqual(draft)
    expect(build(opened.draft, opened.gridRows)).toEqual(saved)
  })

  it('keeps Latin letters, symbols and emojis, also # and .', () => {
    const family = '👨‍👩‍👧'
    const draft: Draft = {
      letters: { '0,2': 'a', '0,3': '@', '0,4': '😀', '0,5': '#', '0,7': '.', '1,0': family, '1,1': 'ა' },
      clues: {},
      title: 'Mixed',
      author: '',
      puzzleId: 'id-3',
      generated: [],
    }
    const saved = build(draft)

    const opened = draftFromPuzzle(JSON.parse(JSON.stringify(saved)))

    expect(opened.gridRows).toEqual(layout)
    expect(opened.draft.letters).toEqual(draft.letters)
    expect(build(opened.draft, opened.gridRows)).toEqual(saved)
  })

  it('opens an unfinished puzzle with empty cells and no question', () => {
    const draft: Draft = {
      letters: { '0,2': 'ა', '0,3': 'ბ' },
      clues: {},
      title: 'ჩანაწერი',
      author: '',
      generated: [],
    }
    const saved = build({ ...draft, puzzleId: 'id-2' })
    expect(saved.rows[0].slice(2, 4)).toEqual(['ა', 'ბ'])
    expect(saved.rows[1].every((cell) => cell === null || cell === '')).toBe(true)

    const opened = draftFromPuzzle(JSON.parse(JSON.stringify(saved)))

    expect(opened.gridRows).toEqual(layout)
    expect(opened.draft.letters).toEqual({ '0,2': 'ა', '0,3': 'ბ' })
    expect(opened.draft.clues).toEqual({})
    expect(opened.draft.author).toBe('')
    expect(opened.draft.puzzleId).toBe('id-2')
    expect(opened.draft.generated).toEqual([])
  })

  it('still opens a version 1 file, where rows are strings', () => {
    const v1: PuzzleV1 = {
      schemaVersion: 1,
      id: 'old-1',
      title: 'Old',
      size: 3,
      rows: ['აბგ', 'დ#ვ', 'ე.ზ'],
      clues: [{ number: 1, direction: 'across', answer: 'აბგ', question: 'პირველი' }],
      savedAt,
    }

    const opened = draftFromPuzzle(JSON.parse(JSON.stringify(v1)))

    expect(opened.gridRows).toEqual(['...', '.#.', '...'])
    expect(opened.draft.letters).toEqual({
      '0,0': 'ა', '0,1': 'ბ', '0,2': 'გ', '1,0': 'დ', '1,2': 'ვ', '2,0': 'ე', '2,2': 'ზ',
    })
    expect(opened.draft.clues).toEqual({ '1-across': 'პირველი' })
    expect(opened.draft.puzzleId).toBe('old-1')
  })
})
