import type { Direction } from '../grids/entries'

export const SCHEMA_VERSION = 2

/**
 * One cell of the solution: `null` for a black cell, `""` for an empty cell, and
 * otherwise what the cell holds. That is one character as a person sees it, so an
 * emoji is one cell, even when it has several code points. `#` and `.` are
 * ordinary content here.
 */
export type PuzzleCell = string | null

/** One word of the grid, with its answer and clue. */
export type Clue = {
  /** The number printed in the word's first cell. */
  number: number
  direction: Direction
  /** The cells of the word from `rows`, joined. An empty cell adds nothing. */
  answer: string
  /** The clue. Empty when it is not written yet. */
  question: string
}

/**
 * The puzzle file that Save crossword downloads. The ujredi server stores it as
 * `data jsonb`, and the app plays it offline.
 *
 * Cell numbers are not stored. They follow from `rows`: a white cell is numbered
 * when it starts an across or a down word, counting left to right, top to bottom.
 */
export type Puzzle = {
  schemaVersion: typeof SCHEMA_VERSION
  /** A UUID. The same crossword keeps its id across saves. */
  id: string
  title: string
  /** Left out when empty. */
  author?: string
  /** Number of rows and of columns. */
  size: number
  /** The solution: `size` rows of `size` cells. */
  rows: PuzzleCell[][]
  /** One item per word, ordered by number, across before down. */
  clues: Clue[]
  /** When the file was saved, as an ISO 8601 date. */
  savedAt: string
}

/**
 * Files from version 1. Each row is a string: `#` is a black cell, `.` is an
 * empty cell, and a Georgian letter is a filled cell. Open still reads these.
 */
export type PuzzleV1 = Omit<Puzzle, 'schemaVersion' | 'rows'> & {
  schemaVersion: 1
  rows: string[]
}
