import { describe, expect, it } from 'vitest'
import type { Entry } from './entries'
import { typeText } from './typing'

const entry: Entry = { number: 1, direction: 'across', cells: [[0, 0], [0, 1], [0, 2]] }

describe('typeText', () => {
  it('types one character and moves to the next cell', () => {
    expect(typeText(entry, [0, 0], {}, 'a')).toEqual({
      letters: { '0,0': 'a' },
      typed: { '0,0': 'a' },
      next: [0, 1],
    })
  })

  it('stays on the last cell at the end of the word', () => {
    expect(typeText(entry, [0, 2], { '0,0': 'x' }, '@')).toEqual({
      letters: { '0,0': 'x', '0,2': '@' },
      typed: { '0,2': '@' },
      next: [0, 2],
    })
  })

  it('fills several cells from pasted text and stops at the end of the word', () => {
    const result = typeText(entry, [0, 1], {}, 'ab😀c')
    expect(result.letters).toEqual({ '0,1': 'a', '0,2': 'b' })
    expect(result.typed).toEqual({ '0,1': 'a', '0,2': 'b' })
    expect(result.next).toEqual([0, 2])
  })

  it('treats an emoji sequence as one cell', () => {
    const family = '👨‍👩‍👧'
    const result = typeText(entry, [0, 0], {}, `${family}b`)
    expect(result.letters).toEqual({ '0,0': family, '0,1': 'b' })
    expect(result.next).toEqual([0, 2])
  })

  it('ignores text without characters, and a cell that is not in the word', () => {
    expect(typeText(entry, [0, 0], { '0,0': 'a' }, ' \n')).toEqual({
      letters: { '0,0': 'a' },
      typed: {},
      next: [0, 0],
    })
    expect(typeText(entry, [5, 5], {}, 'a')).toEqual({ letters: {}, typed: {}, next: [5, 5] })
  })

  it('does not change the letters it was given', () => {
    const letters = { '0,0': 'x' }
    typeText(entry, [0, 0], letters, 'a')
    expect(letters).toEqual({ '0,0': 'x' })
  })
})
