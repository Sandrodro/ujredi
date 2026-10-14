import { BLACK } from './rules'

export type Direction = 'across' | 'down'
export type Cell = [row: number, col: number]

export type Entry = {
  number: number
  direction: Direction
  cells: Cell[]
}

export const cellKey = (row: number, col: number) => `${row},${col}`
export const entryKey = (entry: Pick<Entry, 'number' | 'direction'>) =>
  `${entry.number}-${entry.direction}`

/** Numbers each cell that starts a word, and lists the across and down entries. */
export function findEntries(rows: string[]) {
  const size = rows.length
  const isWhite = (r: number, c: number) =>
    r >= 0 && c >= 0 && r < size && c < size && rows[r][c] !== BLACK

  const numbers = new Map<string, number>()
  const entries: Entry[] = []
  let next = 1

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isWhite(r, c)) continue
      const startsAcross = !isWhite(r, c - 1) && isWhite(r, c + 1)
      const startsDown = !isWhite(r - 1, c) && isWhite(r + 1, c)
      if (!startsAcross && !startsDown) continue

      const number = next++
      numbers.set(cellKey(r, c), number)
      if (startsAcross) entries.push({ number, direction: 'across', cells: walk(r, c, 0, 1) })
      if (startsDown) entries.push({ number, direction: 'down', cells: walk(r, c, 1, 0) })
    }
  }

  function walk(r: number, c: number, dr: number, dc: number): Cell[] {
    const cells: Cell[] = []
    while (isWhite(r, c)) {
      cells.push([r, c])
      r += dr
      c += dc
    }
    return cells
  }

  return { numbers, entries }
}

/** The entry that contains `cell` along `direction`, if any. */
export function findWord(entries: Entry[], cell: Cell, direction: Direction) {
  return entries.find(
    (entry) =>
      entry.direction === direction &&
      entry.cells.some(([r, c]) => r === cell[0] && c === cell[1]),
  )
}
