export const BLACK = '#'

export const GRID_SIZE = 13

export type Tier = 'standard' | 'loose'

/**
 * Black-cell counts and the longest word per tier. `min` and `max` are the target
 * range for sample grids. Above `ceiling` a grid is invalid.
 */
export const TIERS: Record<Tier, { min: number; max: number; ceiling: number; maxWord: number }> = {
  standard: { min: 28, max: 32, ceiling: 34, maxWord: 13 },
  loose: { min: 36, max: 44, ceiling: 46, maxWord: 9 },
}

const MIN_WORD_LENGTH = 3
const MAX_BLOCK_SIZE = 3

export const blackCount = (rows: string[]) =>
  rows.reduce((sum, row) => sum + [...row].filter((ch) => ch === BLACK).length, 0)

const isBlack = (rows: string[], row: number, col: number) => rows[row][col] === BLACK

const isSymmetric = (rows: string[]) => {
  const last = rows.length - 1
  return rows.every((line, r) =>
    [...line].every((ch, c) => (ch === BLACK) === isBlack(rows, last - r, last - c)),
  )
}

const hasBlackBlock = (rows: string[]) => {
  const n = rows.length
  for (let r = 0; r + MAX_BLOCK_SIZE <= n; r++) {
    for (let c = 0; c + MAX_BLOCK_SIZE <= n; c++) {
      let solid = true
      for (let dr = 0; dr < MAX_BLOCK_SIZE && solid; dr++) {
        for (let dc = 0; dc < MAX_BLOCK_SIZE && solid; dc++) {
          solid = isBlack(rows, r + dr, c + dc)
        }
      }
      if (solid) return true
    }
  }
  return false
}

/** Lengths of all runs of white cells, across and down. */
const whiteRunLengths = (rows: string[]) => {
  const n = rows.length
  const lengths: number[] = []
  for (let i = 0; i < n; i++) {
    for (const horizontal of [true, false]) {
      let run = 0
      for (let j = 0; j <= n; j++) {
        const white = j < n && !(horizontal ? isBlack(rows, i, j) : isBlack(rows, j, i))
        if (white) {
          run++
        } else {
          if (run > 0) lengths.push(run)
          run = 0
        }
      }
    }
  }
  return lengths
}

const isConnected = (rows: string[]) => {
  const n = rows.length
  const white: [number, number][] = []
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (!isBlack(rows, r, c)) white.push([r, c])
  }
  if (white.length === 0) return true

  const seen = new Set<string>()
  const stack = [white[0]]
  while (stack.length > 0) {
    const [r, c] = stack.pop()!
    const key = `${r},${c}`
    if (seen.has(key) || r < 0 || c < 0 || r >= n || c >= n || isBlack(rows, r, c)) continue
    seen.add(key)
    stack.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1])
  }
  return seen.size === white.length
}

/** Returns one message per broken rule. An empty list means the grid is valid. */
export function checkGrid(rows: string[], tier: Tier = 'standard'): string[] {
  const limits = TIERS[tier]
  if (rows.length !== GRID_SIZE) return [`Unsupported size ${rows.length}, use ${GRID_SIZE}`]
  if (rows.some((row) => row.length !== rows.length)) return ['Grid must be square']

  const errors: string[] = []
  if (!isSymmetric(rows)) errors.push('Grid has no 180° rotational symmetry')

  const count = blackCount(rows)
  if (count > limits.ceiling) {
    errors.push(`${count} black cells is above the ceiling of ${limits.ceiling}`)
  }
  if (hasBlackBlock(rows)) errors.push('Grid has a solid 3x3 black block')
  const lengths = whiteRunLengths(rows)
  if (lengths.some((length) => length < MIN_WORD_LENGTH)) {
    errors.push(`Grid has a word shorter than ${MIN_WORD_LENGTH} cells`)
  }
  if (lengths.some((length) => length > limits.maxWord)) {
    errors.push(`Grid has a word longer than ${limits.maxWord} cells`)
  }
  if (!isConnected(rows)) errors.push('White cells are not connected')
  return errors
}
