import { describe, expect, it } from 'vitest'
import { endFill, fillMessage, isFilling, setFillMessage, startFill, stopFill } from './fillStatus'

describe('fillStatus', () => {
  it('tracks a running fill per id', () => {
    startFill('a')
    expect(isFilling('a')).toBe(true)
    expect(isFilling('b')).toBe(false)
    endFill('a')
    expect(isFilling('a')).toBe(false)
  })

  it('aborts the signal when the fill is stopped', () => {
    const signal = startFill('a')
    expect(signal.aborted).toBe(false)
    stopFill('a')
    expect(signal.aborted).toBe(true)
    endFill('a')
  })

  it('clears the old message when a fill starts', () => {
    setFillMessage('a', 'old error')
    expect(fillMessage('a')).toBe('old error')
    startFill('a')
    expect(fillMessage('a')).toBeNull()
    endFill('a')
  })
})
