import { cellKey, entryKey, findEntries } from '../grids/entries'
import type { Letters } from '../grids/fill'
import { SCHEMA_VERSION, type Puzzle } from './types'

type BuildInput = {
  id: string
  title: string
  author: string
  /** The grid layout: `#` for black cells, `.` for white cells. */
  gridRows: string[]
  letters: Letters
  /** Clue questions by entry key, as `entryKey` builds it. */
  clues: Record<string, string>
  savedAt: string
}

export function buildPuzzle({ id, title, author, gridRows, letters, clues, savedAt }: BuildInput): Puzzle {
  const trimmedTitle = title.trim()
  if (!trimmedTitle) throw new Error('A puzzle needs a title')

  const rows = gridRows.map((line, r) =>
    [...line].map((ch, c) => (ch === '#' ? null : (letters[cellKey(r, c)] ?? ''))),
  )
  const { entries } = findEntries(gridRows)
  const trimmedAuthor = author.trim()

  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    title: trimmedTitle,
    ...(trimmedAuthor && { author: trimmedAuthor }),
    size: rows.length,
    rows,
    clues: entries.map((entry) => ({
      number: entry.number,
      direction: entry.direction,
      answer: entry.cells.map(([r, c]) => rows[r][c]).join(''),
      question: (clues[entryKey(entry)] ?? '').trim(),
    })),
    savedAt,
  }
}

/** True when every cell has something in it and every word has a clue. */
export const isComplete = (puzzle: Puzzle) =>
  puzzle.rows.every((row) => row.every((cell) => cell !== '')) &&
  puzzle.clues.every((clue) => clue.question !== '')

/** A file name from the title. Georgian letters stay. */
export function puzzleFileName(title: string) {
  // The control characters are the point of this pattern.
  // eslint-disable-next-line no-control-regex
  const name = title.replace(/[/\\:*?"<>|\u0000-\u001f]/g, '').trim()
  return `${name || 'crossword'}.json`
}
