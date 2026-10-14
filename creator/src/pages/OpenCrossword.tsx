import { useState } from 'react'
import { BackButton } from '../components/BackButton'
import { CrosswordEditor } from '../components/CrosswordEditor'
import { draftFromPuzzle } from '../puzzle/draft'
import type { Puzzle } from '../puzzle/types'

/** The editor for a puzzle file. The file brings its own grid, so there is no grid picker. */
export function OpenCrossword({ puzzle, onHome }: { puzzle: Puzzle; onHome: () => void }) {
  const [{ gridRows, draft: first }] = useState(() => draftFromPuzzle(puzzle))
  const [draft, setDraft] = useState(first)
  const [fillId] = useState(() => crypto.randomUUID())

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      <BackButton onClick={onHome} />
      <h1 className="text-3xl font-bold text-slate-900">Make a crossword</h1>

      <CrosswordEditor fillId={fillId} gridRows={gridRows} draft={draft} onDraftChange={setDraft} />
    </main>
  )
}
