import { useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { fetchCandidates, fillErrorMessage, fillGrid, type Candidate } from '../api/fill'
import { cellKey, entryKey, findEntries, findWord, type Cell, type Direction, type Entry } from '../grids/entries'
import {
  afterFill,
  fixedLetters,
  lettersForWord,
  removeByHand,
  rowsForFill,
  setByHand,
  slotPattern,
} from '../grids/fill'
import { endFill, setFillMessage, startFill, stopFill, useFillMessage, useFilling } from '../grids/fillStatus'
import { BLACK, TIERS } from '../grids/rules'
import { typeText } from '../grids/typing'
import { buildPuzzle, isComplete, puzzleFileName } from '../puzzle/build'
import type { Draft } from '../puzzle/draft'
import { downloadJson } from '../puzzle/download'
import { CandidateList } from './CandidateList'
import { ClueList } from './ClueList'
import { CrosswordGrid } from './CrosswordGrid'
import { FillButton } from './FillButton'
import { PuzzleDetails } from './PuzzleDetails'

type Props = {
  /** Names this grid's fill. A fill that runs under this id keeps the buttons disabled after a remount. */
  fillId: string
  /** The grid layout: `#` for black cells, `.` for white cells. */
  gridRows: string[]
  draft: Draft
  onDraftChange: (draft: Draft) => void
}

type Suggestions = { pattern: string; entry: Entry; candidates: Candidate[] | null }

const ARROWS: Record<string, { direction: Direction; dr: number; dc: number }> = {
  ArrowLeft: { direction: 'across', dr: 0, dc: -1 },
  ArrowRight: { direction: 'across', dr: 0, dc: 1 },
  ArrowUp: { direction: 'down', dr: -1, dc: 0 },
  ArrowDown: { direction: 'down', dr: 1, dc: 0 },
}

/**
 * The toolbar, details, grid and clues for one crossword. The caller owns the
 * draft and decides where it is kept. A fill that ends after the caller has
 * moved on still calls `onDraftChange`, so the caller must handle that.
 */
export function CrosswordEditor({ fillId, gridRows, draft, onDraftChange }: Props) {
  const [selected, setSelected] = useState<Cell | null>(null)
  const [direction, setDirection] = useState<Direction>('across')
  const filling = useFilling(fillId)
  // The message is kept per grid outside React, so a fill that ends after a remount still shows its error.
  const message = useFillMessage(fillId)
  const setMessage = (text: string | null) => setFillMessage(fillId, text)
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)

  // Typing goes into a hidden input, so the OS emoji picker, paste and IMEs work.
  const input = useRef<HTMLInputElement>(null)
  const composing = useRef(false)
  const focusInput = () => input.current?.focus({ preventScroll: true })

  const { entries } = useMemo(() => findEntries(gridRows), [gridRows])
  const selectedWord = selected ? findWord(entries, selected, direction) : undefined
  const longWords = entries.some((entry) => entry.cells.length > TIERS.loose.maxWord)

  const runFill = async () => {
    setMessage(null)
    setSavedNote(null)
    setSuggestions(null)
    const signal = startFill(fillId)
    try {
      // Only what you typed or picked stays fixed. The letters of an earlier fill are replaced.
      const filled = await fillGrid(rowsForFill(gridRows, fixedLetters(draft)), signal)
      onDraftChange(afterFill(draft, gridRows, filled))
    } catch (error) {
      // A fill that you stopped is not an error.
      if (!signal.aborted) setMessage(fillErrorMessage(error, longWords))
    } finally {
      endFill(fillId)
      focusInput()
    }
  }

  const suggestWords = async () => {
    if (!selectedWord) return
    const pattern = slotPattern(selectedWord, draft.letters)
    setMessage(null)
    setSuggestions({ pattern, entry: selectedWord, candidates: null })
    try {
      const candidates = await fetchCandidates(pattern)
      setSuggestions((now) => (now?.pattern === pattern ? { ...now, candidates } : now))
    } catch (error) {
      setSuggestions(null)
      setMessage(fillErrorMessage(error))
    }
  }

  const savePuzzle = () => {
    const puzzleId = draft.puzzleId ?? crypto.randomUUID()
    const puzzle = buildPuzzle({
      id: puzzleId,
      title: draft.title,
      author: draft.author,
      gridRows,
      letters: draft.letters,
      clues: draft.clues,
      savedAt: new Date().toISOString(),
    })
    const fileName = puzzleFileName(puzzle.title)
    downloadJson(fileName, puzzle)
    onDraftChange({ ...draft, puzzleId })
    setMessage(null)
    setSavedNote(isComplete(puzzle) ? `Saved ${fileName}` : `Saved ${fileName} (incomplete)`)
    focusInput()
  }

  // Clear starts a new crossword, so it gets a new id on its first save.
  const clearPuzzle = () => {
    onDraftChange({ ...draft, letters: {}, clues: {}, generated: [], puzzleId: undefined })
    setSavedNote(null)
    focusInput()
  }

  const pickWord = (word: string) => {
    if (!suggestions) return
    onDraftChange(setByHand(draft, lettersForWord(suggestions.entry, word)))
    setSuggestions(null)
    focusInput()
  }

  const selectCell = (row: number, col: number) => {
    if (gridRows[row][col] === BLACK) return
    const same = selected?.[0] === row && selected?.[1] === col
    const other: Direction = direction === 'across' ? 'down' : 'across'
    const hasWord = (d: Direction) => findWord(entries, [row, col], d) !== undefined
    setSelected([row, col])
    if (same && hasWord(other)) setDirection(other)
    else if (!hasWord(direction) && hasWord(other)) setDirection(other)
    focusInput()
  }

  const selectEntry = (entry: Entry) => {
    setSelected(entry.cells[0])
    setDirection(entry.direction)
    focusInput()
  }

  const moveBy = (from: Cell, dr: number, dc: number): Cell => {
    const size = gridRows.length
    let [r, c] = [from[0] + dr, from[1] + dc]
    while (r >= 0 && c >= 0 && r < size && c < size) {
      if (gridRows[r][c] !== BLACK) return [r, c]
      r += dr
      c += dc
    }
    return from
  }

  const typeIntoSelected = (text: string) => {
    if (!selected || !selectedWord || filling || !text) return
    const typed = typeText(selectedWord, selected, draft.letters, text)
    onDraftChange(setByHand(draft, typed.typed))
    setSelected(typed.next)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.metaKey || event.ctrlKey || event.altKey) return
    if (!selected || filling) return
    const key = cellKey(selected[0], selected[1])

    const arrow = ARROWS[event.key]
    if (arrow) {
      event.preventDefault()
      setDirection(arrow.direction)
      setSelected(moveBy(selected, arrow.dr, arrow.dc))
    } else if (event.key === 'Backspace') {
      event.preventDefault()
      if (draft.letters[key]) {
        onDraftChange(removeByHand(draft, key))
      } else {
        const index = selectedWord?.cells.findIndex(([r, c]) => r === selected[0] && c === selected[1]) ?? -1
        const prev = selectedWord?.cells[index - 1]
        if (prev) {
          onDraftChange(removeByHand(draft, cellKey(prev[0], prev[1])))
          setSelected(prev)
        }
      }
    }
  }

  // Typed, pasted or picked text lands in the input. Take it and empty the input.
  // While an IME is composing, wait for the composition to end.
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (composing.current) return
    const text = event.target.value
    event.target.value = ''
    typeIntoSelected(text)
  }

  return (
    <div className="space-y-6">
      <input
        ref={input}
        type="text"
        className="sr-only"
        aria-label="Type into the selected cell"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onKeyDown={onKeyDown}
        onChange={onChange}
        onCompositionStart={() => {
          composing.current = true
        }}
        onCompositionEnd={(event) => {
          composing.current = false
          const text = event.currentTarget.value
          event.currentTarget.value = ''
          typeIntoSelected(text)
        }}
      />

      <div className="flex justify-end">
        <div className="flex shrink-0 gap-2">
          <FillButton busy={filling} onClick={runFill}>
            Fill grid
          </FillButton>
          {filling && (
            <button
              type="button"
              onClick={() => stopFill(fillId)}
              className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
            >
              Stop filling
            </button>
          )}
          <FillButton busy={filling} disabled={!selectedWord} onClick={suggestWords}>
            Fill word
          </FillButton>
          <FillButton disabled={filling || !draft.title.trim()} onClick={savePuzzle}>
            Save crossword
          </FillButton>
          <button
            type="button"
            disabled={filling}
            onClick={clearPuzzle}
            className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>

      {savedNote && <p className="rounded bg-green-50 p-2 text-sm text-green-800">{savedNote}</p>}

      {message && (
        <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-700">
          {message}
        </p>
      )}

      {suggestions && (
        <CandidateList
          pattern={suggestions.pattern}
          candidates={suggestions.candidates}
          onPick={pickWord}
          onClose={() => {
            setSuggestions(null)
            focusInput()
          }}
        />
      )}

      <PuzzleDetails
        title={draft.title}
        author={draft.author}
        onTitleChange={(title) => onDraftChange({ ...draft, title })}
        onAuthorChange={(author) => onDraftChange({ ...draft, author })}
      />

      <div className="mx-auto max-w-xl">
        <CrosswordGrid
          rows={gridRows}
          letters={draft.letters}
          generated={draft.grayGenerated ? draft.generated : []}
          selected={selected}
          direction={direction}
          onCellClick={selectCell}
        />
      </div>

      <ClueList
        entries={entries}
        letters={draft.letters}
        clues={draft.clues}
        selectedKey={selectedWord ? entryKey(selectedWord) : null}
        onSelect={selectEntry}
        onClueChange={(entry, text) =>
          onDraftChange({ ...draft, clues: { ...draft.clues, [entryKey(entry)]: text } })
        }
      />
    </div>
  )
}
