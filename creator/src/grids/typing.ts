import type { Cell, Entry } from './entries'
import { cellKey } from './entries'
import type { Letters } from './fill'
import { graphemes } from './text'

/**
 * Types text into a word, one character per cell, starting at `from`. Stops at
 * the end of the word. Returns the new letters, the letters that were typed, and
 * the cell to select next: the cell after the last one typed, or that last cell
 * when the word ends there.
 */
export function typeText(entry: Entry, from: Cell, letters: Letters, text: string) {
  const typed = graphemes(text)
  const start = entry.cells.findIndex(([r, c]) => r === from[0] && c === from[1])
  if (typed.length === 0 || start === -1) return { letters, typed: {} as Letters, next: from }

  const placed: Letters = {}
  let index = start
  for (const character of typed) {
    if (index >= entry.cells.length) break
    const [r, c] = entry.cells[index]
    placed[cellKey(r, c)] = character
    index++
  }
  return {
    letters: { ...letters, ...placed },
    typed: placed,
    next: entry.cells[Math.min(index, entry.cells.length - 1)],
  }
}
