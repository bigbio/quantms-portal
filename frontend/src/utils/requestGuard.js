// Tiny helper for "latest request wins" async flows.
//
//   const guard = createRequestGuard()
//   const isCurrent = guard.next()
//   const data = await fetchSomething()
//   if (!isCurrent()) return   // a newer request started meanwhile
export function createRequestGuard() {
  let seq = 0
  return {
    /** Start a request; returns a function telling whether it is still the latest. */
    next() {
      const id = ++seq
      return () => id === seq
    },
    /** Invalidate every request started so far. */
    invalidate() {
      seq++
    },
  }
}
