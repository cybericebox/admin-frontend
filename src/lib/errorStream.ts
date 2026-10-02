"use client"
/* eslint-disable @eslint-react/web-api-no-leaked-event-listener -- the listeners live on the EventSource, which close() drops in the cleanup */

import { useEffect, useRef, useState } from "react"
import { errorStreamUrl, type ErrorStreamEvent } from "@/api/errorJournal"

// The server sends a "heartbeat" event every 15 s; a stream silent for twice that long is broken.
export const heartbeatEvent = "heartbeat"
export const staleStreamMs = 30_000
export const streamFailureLimit = 3
export const fallbackRetryMs = 30_000

export type StreamMode = "connecting" | "live" | "fallback"

/** 1 s, 2 s, 4 s … up to 30 s between reconnects. */
export const reconnectDelay = (failures: number) => Math.min(30_000, 1000 * 2 ** Math.max(0, failures - 1))
/** ±20 %, so many open pages do not reconnect in step. */
export const jitter = (ms: number, random: () => number = Math.random) => Math.round(ms * (0.8 + 0.4 * random()))
export const streamMode = (failures: number, open: boolean): StreamMode => (failures >= streamFailureLimit ? "fallback" : open ? "live" : "connecting")

/**
 * Live "error-group" events of the journal. Nothing is replayed, so `onResync` runs whenever the stream
 * (re)opens or breaks: the page then refetches quietly. The server ends a stream after 30 minutes and caps
 * an account at three: the stream closes while the tab is hidden and reconnects when it is shown. After
 * repeated failures the mode is "fallback" and the caller keeps its list fresh by the resyncs alone.
 */
export function useErrorStream({ enabled, onEvent, onResync }: {
  enabled: boolean
  onEvent: (event: ErrorStreamEvent) => void
  onResync: () => void
}): StreamMode {
  const [state, setState] = useState({ failures: 0, open: false })
  const latest = useRef({ onEvent, onResync })
  useEffect(() => { latest.current = { onEvent, onResync } })

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return
    let source: EventSource | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let failures = 0
    let stopped = false
    let paused = document.hidden
    let lastAlive = 0
    const close = () => { source?.close(); source = null }
    const schedule = (delay: number) => { if (!stopped) timer = setTimeout(connect, delay) }
    function connect() {
      timer = null
      const target = errorStreamUrl()
      if (!target || stopped || paused) return
      source = new EventSource(target, { withCredentials: true })
      lastAlive = Date.now()
      const alive = () => { lastAlive = Date.now() }
      source.onopen = () => { failures = 0; setState({ failures: 0, open: true }); alive(); latest.current.onResync() }
      source.addEventListener("error-group", (message) => {
        alive()
        try { latest.current.onEvent(JSON.parse((message as MessageEvent<string>).data) as ErrorStreamEvent) } catch { /* A malformed event is skipped. */ }
      })
      source.addEventListener(heartbeatEvent, alive)
      source.onerror = () => fail()
    }
    function fail() {
      close()
      failures += 1
      setState({ failures, open: false })
      latest.current.onResync()
      schedule(jitter(failures < streamFailureLimit ? reconnectDelay(failures) : fallbackRetryMs))
    }
    const watchdog = setInterval(() => {
      if (source && Date.now() - lastAlive > staleStreamMs) fail()
    }, 5000)
    const onVisibility = () => {
      if (document.hidden) {
        paused = true
        if (timer) clearTimeout(timer)
        timer = null
        close()
        setState((current) => ({ ...current, open: false }))
        return
      }
      if (!paused) return
      paused = false
      failures = 0
      setState({ failures: 0, open: false })
      schedule(0)
    }
    document.addEventListener("visibilitychange", onVisibility)
    connect()
    return () => {
      stopped = true
      clearInterval(watchdog)
      document.removeEventListener("visibilitychange", onVisibility)
      if (timer) clearTimeout(timer)
      close()
    }
  }, [enabled])

  return streamMode(state.failures, state.open)
}
