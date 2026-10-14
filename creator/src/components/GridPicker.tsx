import type { Grid } from '../grids/samples'
import { blackCount } from '../grids/rules'
import { CrosswordGrid } from './CrosswordGrid'

type Props = {
  grids: Grid[]
  selectedId: string
  onSelect: (id: string) => void
}

export function GridPicker({ grids, selectedId, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-4">
      {grids.map((grid) => (
        <button
          key={grid.id}
          type="button"
          onClick={() => onSelect(grid.id)}
          className={`w-36 rounded border-2 p-2 text-left ${
            grid.id === selectedId ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-slate-400'
          }`}
        >
          <CrosswordGrid rows={grid.rows} compact />
          <div className="mt-1 text-sm text-slate-700">
            {grid.tier}, {blackCount(grid.rows)} black
          </div>
        </button>
      ))}
    </div>
  )
}
