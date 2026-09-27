/**
 * autosaveQueue.ts — serialized, coalescing autosave.
 *
 * markChanged() (re)starts the debounce timer; flush() sends at once. At most
 * one save runs at a time. save() reads the latest values itself, so all edits
 * made while a request is in flight go out in exactly one follow-up request.
 * save() resolves false when nothing can be persisted yet (a new exercise
 * without a valid name): the changes stay pending and status returns to idle.
 */
export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error"

export type AutosaveQueueOptions = {
  delayMs: number
  save: () => Promise<boolean>
  onStatus: (status: AutosaveStatus) => void
  onSaved?: () => void
}

export class AutosaveQueue {
  private dirty = false
  private running: Promise<boolean> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly options: AutosaveQueueOptions) {}

  markChanged(): void {
    this.dirty = true
    if (!this.running) this.options.onStatus("pending")
    this.clearTimer()
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, this.options.delayMs)
  }

  flush(): Promise<boolean> {
    this.clearTimer()
    if (this.running) return this.running.then(() => this.flush())
    if (!this.dirty) return Promise.resolve(true)
    this.running = this.drain().finally(() => { this.running = null })
    return this.running
  }

  hasUnsaved(): boolean {
    return this.dirty || this.running !== null
  }

  /** Forget pending changes (the user abandoned them). An in-flight request still completes. */
  discard(): void {
    this.clearTimer()
    this.dirty = false
    if (!this.running) this.options.onStatus("idle")
  }

  private async drain(): Promise<boolean> {
    while (this.dirty) {
      this.dirty = false
      this.options.onStatus("saving")
      let persisted: boolean
      try {
        persisted = await this.options.save()
      } catch {
        this.dirty = true
        this.options.onStatus("error")
        return false
      }
      if (!persisted) {
        this.dirty = true
        this.options.onStatus("idle")
        return false
      }
    }
    this.options.onStatus("saved")
    this.options.onSaved?.()
    return true
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
  }
}
