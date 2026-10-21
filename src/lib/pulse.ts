// One pulse loop per tab, shared by the banner bar and the inbox button.
// Every ~30 s ±20 % while the tab is visible; paused when hidden; one immediate pulse on
// visible / focus / online (at most once per 5 s) and when the API comes back from an outage.

import { fetchPulse, type Pulse } from "@/api/notifications/pulse"
import { onServiceRestored } from "@/lib/serviceStatus"

export const PULSE_INTERVAL_MS = 30_000
export const PULSE_JITTER = 0.2
export const PULSE_MIN_GAP_MS = 5_000

/** 30 s ± 20 %. */
export function pulseDelay(random: () => number = Math.random): number {
  return Math.round(PULSE_INTERVAL_MS * (1 + (random() * 2 - 1) * PULSE_JITTER))
}

export type PulseListener = (pulse: Pulse) => void

export type PulseLoop = {
  /** The listener gets the latest known pulse at once (if any) and every later one. The loop runs while it has listeners. */
  subscribe(listener: PulseListener): () => void
  /** An immediate pulse. `force` skips the 5 s gap (a user action or a restored API). */
  pulseNow(force?: boolean): void
}

const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden"

export function createPulseLoop(fetchOnce: () => Promise<Pulse>): PulseLoop {
  const listeners = new Set<PulseListener>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let inflight = false
  let lastAt = -Infinity
  let last: Pulse | null = null
  let detach: (() => void) | null = null

  const clear = () => { if (timer !== undefined) { clearTimeout(timer); timer = undefined } }

  function schedule() {
    clear()
    if (listeners.size === 0 || hidden()) return
    timer = setTimeout(run, pulseDelay())
  }

  function run() {
    clear()
    if (inflight || listeners.size === 0) return
    inflight = true
    lastAt = Date.now()
    fetchOnce()
      .then((pulse) => {
        last = pulse
        for (const listener of [...listeners]) listener(pulse)
      })
      .catch(() => { /* A pulse outage must not block the page; the next tick retries. */ })
      .finally(() => { inflight = false; schedule() })
  }

  function pulseNow(force = false) {
    if (listeners.size === 0 || hidden()) return
    if (!force && Date.now() - lastAt < PULSE_MIN_GAP_MS) return
    run()
  }

  function attach() {
    const onVisibility = () => { if (hidden()) clear(); else pulseNow() }
    const onWake = () => pulseNow()
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("focus", onWake)
    window.addEventListener("online", onWake)
    const unsubscribe = onServiceRestored(() => pulseNow(true))
    detach = () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus", onWake)
      window.removeEventListener("online", onWake)
      unsubscribe()
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      if (listeners.size === 1) {
        attach()
        pulseNow(true)
      } else if (last) {
        const known = last
        queueMicrotask(() => { if (listeners.has(listener)) listener(known) })
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          clear()
          detach?.()
          detach = null
          last = null
        }
      }
    },
    pulseNow,
  }
}

const loops = new Map<string, PulseLoop>()

/** The shared loop of this tab for a scope (the platform, or one event). */
export function getPulseLoop(event?: string): PulseLoop {
  const key = event ?? ""
  let loop = loops.get(key)
  if (!loop) { loop = createPulseLoop(() => fetchPulse(event)); loops.set(key, loop) }
  return loop
}
