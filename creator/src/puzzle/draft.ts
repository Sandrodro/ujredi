import { cellKey, entryKey } from '../grids/entries'
import type { Letters } from '../grids/fill'
import type { Puzzle, PuzzleCell, PuzzleV1 } from './types'

/** What the editor works on: the typed letters, the clues and the puzzle details. */
export type Draft = {
  letters: Letters
  /** Clue questions by entry key, as `entryKey` builds it. */
  clues: Record<string, string>
  title: string
  author: string
  /** Created on the first save, so later saves of this crossword keep the same id. */
  puzzleId?: string
  /** Keys of the cells whose letter the filler wrote. A refill replaces these and keeps the rest. */
  generated: string[]
  /** True when the last fill kept letters you typed or picked. Only then the generated letters show in gray. */
  grayGenerated?: boolean
}

export const EMPTY_DRAFT: Draft = { letters: {}, clues: {}, title: '', author: '', generated: [] }

// A version 1 row is a string of `#`, `.` and Georgian letters, so each code point is a cell.
const cellsOfV1Row = (row: string): PuzzleCell[] =>
  [...row].map((ch) => (ch === '#' ? null : ch === '.' ? '' : ch))

/**
 * The editor state for a puzzle file, of version 1 or 2. `gridRows` is the
 * layout (`#` and `.`), and what the cells hold becomes the typed letters.
 */
export function draftFromPuzzle(puzzle: Puzzle | PuzzleV1): { gridRows: string[]; draft: Draft } {
  const letters: Letters = {}
  const gridRows = puzzle.rows.map((row, r) => {
    const cells = typeof row === 'string' ? cellsOfV1Row(row) : row
    return cells
      .map((cell, c) => {
        if (cell === null) return '#'
        if (cell !== '') letters[cellKey(r, c)] = cell
        return '.'
      })
      .join('')
  })

  const clues: Record<string, string> = {}
  for (const clue of puzzle.clues) {
    if (clue.question) clues[entryKey(clue)] = clue.question
  }

  return {
    gridRows,
    draft: {
      letters,
      clues,
      title: puzzle.title ?? '',
      author: puzzle.author ?? '',
      puzzleId: puzzle.id,
      generated: [],
    },
  }
}
