import { describe, expect, it } from 'vitest'
import { FillError, fillErrorMessage } from './fill'

describe('fillErrorMessage', () => {
  it('adds the loose grid hint to an unfillable grid with long words', () => {
    expect(fillErrorMessage(new FillError('unfillable'), true)).toContain('Try a loose grid.')
  })

  it('has no hint without long words', () => {
    expect(fillErrorMessage(new FillError('unfillable'))).not.toContain('loose grid')
  })

  it('has no hint for other errors', () => {
    expect(fillErrorMessage(new FillError('timeout'), true)).not.toContain('loose grid')
  })
})
