import { useMemo } from 'react'
import { cellKey, findEntries, findWord, type Cell, type Direction } from '../grids/entries'
import { BLACK } from '../grids/rules'

type Props = {
  rows: string[]
  /** Letters by cell key (`"row,col"`). */
  letters?: Record<string, string>
  /** Keys of the cells whose letter the filler wrote. They are shown in gray. */
  generated?: string[]
  selected?: Cell | null
  direction?: Direction
  /** Small, read-only version without numbers and letters. */
  compact?: boolean
  onCellClick?: (row: number, col: number) => void
}

export function CrosswordGrid({
  rows,
  letters = {},
  generated = [],
  selected = null,
  direction = 'across',
  compact = false,
  onCellClick,
}: Props) {
  const size = rows.length
  const { entries, numbers } = useMemo(() => findEntries(rows), [rows])
  const generatedKeys = useMemo(() => new Set(generated), [generated])
  const wordCells = useMemo(() => {
    const word = selected && findWord(entries, selected, direction)
    return new Set(word ? word.cells.map(([r, c]) => cellKey(r, c)) : [])
  }, [entries, selected, direction])

  return (
    <div
      className="grid aspect-square w-full border-2 border-black bg-black"
      style={{
        gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
        gap: compact ? 0 : 1,
      }}
    >
      {rows.map((line, r) =>
        [...line].map((ch, c) => {
          const key = cellKey(r, c)
          if (ch === BLACK) return <div key={key} className="bg-black" />

          const isSelected = selected?.[0] === r && selected?.[1] === c
          const background = isSelected
            ? 'bg-amber-300'
            : wordCells.has(key)
              ? 'bg-amber-100'
              : 'bg-white'
          return (
            <div
              key={key}
              onClick={onCellClick && (() => onCellClick(r, c))}
              className={`relative flex items-center justify-center overflow-hidden ${background} ${onCellClick ? 'cursor-pointer' : ''}`}
            >
              {!compact && numbers.has(key) && (
                <span className="absolute left-0.5 top-0 text-[9px] leading-tight text-slate-600">
                  {numbers.get(key)}
                </span>
              )}
              {!compact && (
                <span
                  className={`text-lg font-semibold leading-none ${generatedKeys.has(key) ? 'text-slate-400' : ''}`}
                >
                  {letters[key]}
                </span>
              )}
            </div>
          )
        }),
      )}
    </div>
  )
}
