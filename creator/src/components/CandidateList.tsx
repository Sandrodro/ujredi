import type { Candidate } from '../api/fill'

type Props = {
  pattern: string
  /** `null` while loading. */
  candidates: Candidate[] | null
  onPick: (word: string) => void
  onClose: () => void
}

export function CandidateList({ pattern, candidates, onPick, onClose }: Props) {
  return (
    <section className="rounded border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">
          Words for <span className="font-mono tracking-wider">{pattern}</span>
        </h2>
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
          Close
        </button>
      </div>
      <p className="mb-2 text-xs text-slate-500">
        Matches the letters typed in this word. Crossing words are not checked.
      </p>
      {candidates === null && <p className="text-sm">Loading…</p>}
      {candidates?.length === 0 && <p className="text-sm">No words match.</p>}
      <ul className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
        {candidates?.map(({ word, source }) => (
          <li key={word}>
            <button
              type="button"
              onClick={() => onPick(word)}
              title={source}
              className="rounded border border-slate-300 px-2 py-0.5 text-sm hover:bg-amber-100"
            >
              {word}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
