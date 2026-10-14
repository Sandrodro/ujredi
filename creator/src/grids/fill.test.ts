import { describe, expect, it } from 'vitest'
import type { Entry } from './entries'
import type { Draft } from '../puzzle/draft'
import { afterFill, fixedLetters, lettersForWord, lettersFromRows, removeByHand, rowsForFill, setByHand, slotPattern } from './fill'

const grid = ['...', '.#.', '...']
const entry: Entry = { number: 1, direction: 'across', cells: [[0, 0], [0, 1], [0, 2]] }

describe('rowsForFill', () => {
  it('places typed letters and keeps black cells', () => {
    expect(rowsForFill(grid, { '0,0': 'ა', '2,2': 'ბ' })).toEqual(['ა..', '.#.', '..ბ'])
  })

  it('ignores a letter typed on a black cell', () => {
    expect(rowsForFill(grid, { '1,1': 'ა' })).toEqual(grid)
  })
})

describe('lettersFromRows', () => {
  it('reads every white cell of the filled grid', () => {
    const letters = lettersFromRows(grid, ['აბგ', 'დ#ე', 'ვზთ'])
    expect(letters['0,0']).toBe('ა')
    expect(letters['2,2']).toBe('თ')
    expect(letters['1,1']).toBeUndefined()
    expect(Object.keys(letters)).toHaveLength(8)
  })
})

describe('slotPattern', () => {
  it('uses dots for empty cells', () => {
    expect(slotPattern(entry, { '0,0': 'ა', '0,2': 'ბ' })).toBe('ა.ბ')
    expect(slotPattern(entry, {})).toBe('...')
  })
})

describe('lettersForWord', () => {
  it('maps each letter to its cell', () => {
    expect(lettersForWord(entry, 'აბგ')).toEqual({ '0,0': 'ა', '0,1': 'ბ', '0,2': 'გ' })
  })
})

const draft: Draft = {
  letters: { '0,0': 'ა', '0,1': 'ბ', '0,2': 'გ' },
  clues: {},
  title: 'T',
  author: '',
  generated: ['0,1', '0,2'],
}

describe('fixedLetters', () => {
  it('leaves out the letters the filler wrote', () => {
    expect(fixedLetters(draft)).toEqual({ '0,0': 'ა' })
  })

  it('keeps everything when nothing is generated', () => {
    expect(fixedLetters({ ...draft, generated: [] })).toEqual(draft.letters)
  })
})

describe('afterFill', () => {
  const filled = ['ადე', 'ვ#ზ', 'თიკ']

  it('takes the filler letters and marks the cells that were not fixed as generated', () => {
    const next = afterFill(draft, grid, filled)
    expect(next.letters['0,0']).toBe('ა')
    expect(next.letters['0,1']).toBe('დ')
    expect(next.letters['2,2']).toBe('კ')
    expect(Object.keys(next.letters)).toHaveLength(8)
    expect(next.generated.sort()).toEqual(['0,1', '0,2', '1,0', '1,2', '2,0', '2,1', '2,2'])
    expect(next.generated).not.toContain('0,0')
  })

  it('refills: the second fill replaces the first one and keeps the typed letter', () => {
    const first = afterFill({ ...draft, letters: { '0,0': 'ა' }, generated: [] }, grid, filled)
    const second = afterFill(first, grid, ['ახე', 'ბ#ზ', 'თიკ'])
    expect(fixedLetters(first)).toEqual({ '0,0': 'ა' })
    expect(second.letters['0,1']).toBe('ხ')
    expect(second.letters['0,0']).toBe('ა')
    expect(second.generated).not.toContain('0,0')
  })

  it('shows generated letters in gray only when the fill kept a typed letter', () => {
    expect(afterFill(draft, grid, filled).grayGenerated).toBe(true)
    expect(afterFill({ ...draft, letters: {}, generated: [] }, grid, filled).grayGenerated).toBe(false)
  })
})

describe('setByHand and removeByHand', () => {
  it('a letter set by hand is no longer generated', () => {
    const next = setByHand(draft, { '0,1': 'ზ' })
    expect(next.letters['0,1']).toBe('ზ')
    expect(next.generated).toEqual(['0,2'])
    expect(fixedLetters(next)).toEqual({ '0,0': 'ა', '0,1': 'ზ' })
  })

  it('setting the same letter by hand still takes the cell out of generated', () => {
    expect(setByHand(draft, { '0,1': 'ბ' }).generated).toEqual(['0,2'])
  })

  it('removing a letter empties the cell and takes it out of generated', () => {
    const next = removeByHand(draft, '0,2')
    expect(next.letters).toEqual({ '0,0': 'ა', '0,1': 'ბ' })
    expect(next.generated).toEqual(['0,1'])
  })

  it('does not change the draft it was given', () => {
    setByHand(draft, { '0,1': 'ზ' })
    removeByHand(draft, '0,2')
    expect(draft.generated).toEqual(['0,1', '0,2'])
    expect(draft.letters['0,1']).toBe('ბ')
  })
})
