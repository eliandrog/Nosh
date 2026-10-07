import { useEffect, useState } from 'react'

/** Returns `value` once it has stopped changing for `delayMs` (e.g. to avoid an API call per key press). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
