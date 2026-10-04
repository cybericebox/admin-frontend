import { useEffect, useState } from "react"

/** A debounced copy of a value: a text field stays responsive, the request waits. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    if (value === debounced) return
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, debounced, delay])
  return debounced
}
