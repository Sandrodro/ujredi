import { useState } from 'react'
import { OpenFileButton } from '../components/OpenFileButton'
import type { Puzzle } from '../puzzle/types'

const BUTTON = 'rounded-lg px-8 py-4 text-lg font-semibold'

type Props = {
  onCreate: () => void
  onOpen: (puzzle: Puzzle) => void
}

export function Home({ onCreate, onOpen }: Props) {
  const [error, setError] = useState<string | null>(null)

  const openFile = async (file: File) => {
    try {
      const puzzle: Puzzle = JSON.parse(await file.text())
      // Reading the rows is the only check for now: it fails for a file that is not a puzzle.
      if (!Array.isArray(puzzle.rows) || !Array.isArray(puzzle.clues)) throw new Error('not a puzzle')
      setError(null)
      onOpen(puzzle)
    } catch {
      setError('Could not open this file.')
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold text-slate-900">Ujredi creator</h1>
      <div className="flex gap-4">
        <button type="button" onClick={onCreate} className={`${BUTTON} bg-amber-500 text-white hover:bg-amber-600`}>
          Create
        </button>
        <OpenFileButton
          accept=".json,application/json"
          onFile={openFile}
          className={`${BUTTON} border-2 border-slate-300 hover:bg-slate-100`}
        >
          Open
        </OpenFileButton>
      </div>
      {error && (
        <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </main>
  )
}
