import type { Draft } from '../puzzle/draft'
import { cellKey, type Entry } from './entries'
import { BLACK } from './rules'

/** Typed letters by cell key (`"row,col"`). */
export type Letters = Record<string, string>

/** The grid rows for the filler, with the typed letters placed in their cells. */
export function rowsForFill(rows: string[], letters: Letters): string[] {
  return rows.map((line, r) =>
    [...line].map((ch, c) => (ch === BLACK ? ch : (letters[cellKey(r, c)] ?? ch))).join(''),
  )
}

/** The letters of every white cell in a filled grid. */
export function lettersFromRows(gridRows: string[], filledRows: string[]): Letters {
  const letters: Letters = {}
  gridRows.forEach((line, r) => {
    ;[...line].forEach((ch, c) => {
      if (ch !== BLACK) letters[cellKey(r, c)] = filledRows[r][c]
    })
  })
  return letters
}

/** The letters of one slot, with `.` for empty cells. For example `მგ...`. */
export function slotPattern(entry: Entry, letters: Letters): string {
  return entry.cells.map(([r, c]) => letters[cellKey(r, c)] ?? '.').join('')
}

/** The letters to set so that `word` is written into the slot. */
export function lettersForWord(entry: Entry, word: string): Letters {
  const letters: Letters = {}
  entry.cells.forEach(([r, c], i) => {
    letters[cellKey(r, c)] = word[i]
  })
  return letters
}

/** The letters that were typed or picked by hand: every letter the filler did not write. */
export function fixedLetters({ letters, generated }: Pick<Draft, 'letters' | 'generated'>): Letters {
  const skip = new Set(generated)
  return Object.fromEntries(Object.entries(letters).filter(([key]) => !skip.has(key)))
}

/**
 * The draft after a fill. Every cell gets the filler's letter. The cells that were
 * not fixed by hand are the generated ones, so the next fill replaces them.
 */
export function afterFill(draft: Draft, gridRows: string[], filledRows: string[]): Draft {
  const fixed = fixedLetters(draft)
  const letters = lettersFromRows(gridRows, filledRows)
  return {
    ...draft,
    letters,
    generated: Object.keys(letters).filter((key) => !(key in fixed)),
    grayGenerated: Object.keys(fixed).length > 0,
  }
}

/** Sets letters by hand. A cell set by hand is no longer generated, so a refill keeps it. */
export function setByHand(draft: Draft, changes: Letters): Draft {
  return {
    ...draft,
    letters: { ...draft.letters, ...changes },
    generated: draft.generated.filter((key) => !(key in changes)),
  }
}

/** Empties one cell by hand. */
export function removeByHand(draft: Draft, key: string): Draft {
  const { [key]: _removed, ...letters } = draft.letters
  return { ...draft, letters, generated: draft.generated.filter((k) => k !== key) }
}
