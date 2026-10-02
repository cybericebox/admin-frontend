import type { ErrorGroup, ErrorStatus } from "@/api/errorJournal"

type Hooks = {
  patch: (id: string, status: ErrorStatus) => Promise<ErrorGroup>
  /** Shows the chosen status at once, before the server answers. */
  optimistic: (id: string, status: ErrorStatus) => void
  /** The server's answer, only when no newer change of that group is waiting. */
  confirmed: (group: ErrorGroup) => void
  /** The save failed and nothing newer is waiting: put `status` back (and tell the person). */
  failed: (id: string, status: ErrorStatus, error: unknown) => void
}

/**
 * Saves status changes one after another (a promise chain), so quick changes never race. A pending save
 * never blocks anything: every change shows at once and is queued. Per group, only the last answer counts.
 */
export function createStatusQueue(hooks: Hooks) {
  let chain: Promise<void> = Promise.resolve()
  const waiting = new Map<string, number>()
  const known = new Map<string, ErrorStatus>()

  return {
    set(id: string, shown: ErrorStatus, next: ErrorStatus) {
      if (!known.has(id)) known.set(id, shown)
      waiting.set(id, (waiting.get(id) ?? 0) + 1)
      hooks.optimistic(id, next)
      chain = chain.then(async () => {
        try {
          const group = await hooks.patch(id, next)
          known.set(id, group.Status)
          const left = (waiting.get(id) ?? 1) - 1
          waiting.set(id, left)
          if (left === 0) hooks.confirmed(group)
        } catch (error) {
          const left = (waiting.get(id) ?? 1) - 1
          waiting.set(id, left)
          if (left === 0) hooks.failed(id, known.get(id) ?? shown, error)
        }
      })
    },
  }
}
