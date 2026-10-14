import { useEffect, useRef, useState } from 'react'
import { BackButton } from '../components/BackButton'
import { CrosswordEditor } from '../components/CrosswordEditor'
import { GridPicker } from '../components/GridPicker'
import { useFilling } from '../grids/fillStatus'
import { SAMPLE_GRIDS } from '../grids/samples'
import { EMPTY_DRAFT, type Draft } from '../puzzle/draft'

const storageKey = (gridId: string) => `creator:fill:${gridId}`

function loadDraft(gridId: string): Draft {
  try {
    const raw = localStorage.getItem(storageKey(gridId))
    return raw ? { ...EMPTY_DRAFT, ...JSON.parse(raw) } : EMPTY_DRAFT
  } catch {
    return EMPTY_DRAFT
  }
}

function saveDraft(gridId: string, draft: Draft) {
  try {
    localStorage.setItem(storageKey(gridId), JSON.stringify(draft))
  } catch {
    // Storage can be blocked. The page still works without saving.
  }
}

/** Pick one of the sample grids and fill it. Each grid keeps its own draft in the browser. */
export function MakeCrossword({ onHome }: { onHome: () => void }) {
  const [gridId, setGridId] = useState(SAMPLE_GRIDS[0].id)
  const [draft, setDraft] = useState<Draft>(() => loadDraft(SAMPLE_GRIDS[0].id))

  // The grid that is on screen now. A fill that ends later has the id of the
  // grid it started on, and only updates the screen when that grid is still shown.
  const gridIdRef = useRef(gridId)
  useEffect(() => {
    gridIdRef.current = gridId
  }, [gridId])

  // A fill that started on an earlier copy of this page saves its result to storage only.
  // When a fill ends, the storage holds the newest draft, so show it.
  const filling = useFilling(gridId)
  const [wasFilling, setWasFilling] = useState(filling)
  if (wasFilling !== filling) {
    setWasFilling(filling)
    if (!filling) setDraft(loadDraft(gridId))
  }

  const commitDraft = (id: string, next: Draft) => {
    saveDraft(id, next)
    if (gridIdRef.current === id) setDraft(next)
  }

  const selectGrid = (id: string) => {
    setGridId(id)
    setDraft(loadDraft(id))
  }

  const grid = SAMPLE_GRIDS.find((g) => g.id === gridId)!

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      <BackButton onClick={onHome} />
      <h1 className="text-3xl font-bold text-slate-900">Make a crossword</h1>

      <GridPicker grids={SAMPLE_GRIDS} selectedId={gridId} onSelect={selectGrid} />

      <CrosswordEditor
        key={gridId}
        fillId={gridId}
        gridRows={grid.rows}
        draft={draft}
        onDraftChange={(next) => commitDraft(gridId, next)}
      />
    </main>
  )
}
