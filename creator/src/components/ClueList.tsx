import { cellKey, entryKey, type Direction, type Entry } from '../grids/entries'

type Props = {
  entries: Entry[]
  letters: Record<string, string>
  clues: Record<string, string>
  selectedKey: string | null
  onSelect: (entry: Entry) => void
  onClueChange: (entry: Entry, text: string) => void
}

const DIRECTIONS: { direction: Direction; title: string }[] = [
  { direction: 'across', title: 'Across' },
  { direction: 'down', title: 'Down' },
]

export function ClueList({ entries, letters, clues, selectedKey, onSelect, onClueChange }: Props) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {DIRECTIONS.map(({ direction, title }) => (
        <section key={direction}>
          <h2 className="mb-2 text-lg font-semibold">{title}</h2>
          <ul className="space-y-1">
            {entries
              .filter((entry) => entry.direction === direction)
              .map((entry) => {
                const key = entryKey(entry)
                const pattern = entry.cells
                  .map(([r, c]) => letters[cellKey(r, c)] ?? '_')
                  .join('')
                return (
                  <li
                    key={key}
                    onClick={() => onSelect(entry)}
                    className={`flex items-center gap-2 rounded p-1 ${key === selectedKey ? 'bg-amber-100' : ''}`}
                  >
                    <span className="w-6 text-right font-semibold">{entry.number}</span>
                    <span className="w-28 shrink-0 font-mono text-sm tracking-wider">{pattern}</span>
                    <input
                      type="text"
                      value={clues[key] ?? ''}
                      onChange={(e) => onClueChange(entry, e.target.value)}
                      placeholder="Clue"
                      className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-0.5 text-sm"
                    />
                  </li>
                )
              })}
          </ul>
        </section>
      ))}
    </div>
  )
}
