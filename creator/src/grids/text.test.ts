import { describe, expect, it } from 'vitest'
import { graphemes } from './text'

describe('graphemes', () => {
  it('splits Georgian, Latin and symbols one by one', () => {
    expect(graphemes('აბa@#.')).toEqual(['ა', 'ბ', 'a', '@', '#', '.'])
  })

  it('keeps an emoji as one character', () => {
    expect(graphemes('😀')).toEqual(['😀'])
  })

  it('keeps an emoji sequence as one character', () => {
    const family = '👨‍👩‍👧'
    expect(family.length).toBeGreaterThan(2)
    expect(graphemes(`${family}a`)).toEqual([family, 'a'])
    expect(graphemes('👍🏽')).toEqual(['👍🏽'])
  })

  it('drops spaces, line breaks and invisible characters', () => {
    expect(graphemes(' a\tb\nc​ ')).toEqual(['a', 'b', 'c'])
    expect(graphemes('')).toEqual([])
  })
})
