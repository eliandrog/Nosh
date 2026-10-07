import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from './useDebouncedValue'

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('only updates after the value stops changing for the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'l' },
    })

    rerender({ value: 'le' })
    act(() => vi.advanceTimersByTime(200))
    rerender({ value: 'len' })
    act(() => vi.advanceTimersByTime(299))
    expect(result.current).toBe('l') // still the first value: typing hasn't paused for 300ms

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('len') // intermediate "le" was skipped
  })
})
