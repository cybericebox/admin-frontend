"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type SetStateAction } from "react"
import { sameTemplateValue } from "./templateEditorState"

/** Compare the submitted value with the last acknowledged server value, retaining edits made during a save. */
export function useSavedDraft<Draft, Payload>(server: Draft, normalize: (draft: Draft) => Payload) {
  const [draft, updateDraft] = useState(server)
  const [baseline, updateBaseline] = useState(server)
  const current = useRef(draft)
  const acknowledged = useRef(baseline)
  const normalizer = useRef(normalize)
  useLayoutEffect(() => { normalizer.current = normalize }, [normalize])
  const lastServer = useRef(server)

  const setDraft = useCallback((next: SetStateAction<Draft>) => {
    const value = typeof next === "function" ? (next as (value: Draft) => Draft)(current.current) : next
    current.current = value
    updateDraft(value)
  }, [])

  const accept = useCallback((saved: Draft, submitted?: Payload) => {
    const unchanged = sameTemplateValue(normalizer.current(current.current), submitted ?? normalizer.current(acknowledged.current))
    acknowledged.current = saved
    updateBaseline(saved)
    if (unchanged) setDraft(saved)
    return unchanged
  }, [setDraft])

  useEffect(() => {
    if (sameTemplateValue(normalize(server), normalize(lastServer.current))) return
    lastServer.current = server
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reconcile a new acknowledged server value without overwriting a draft
    accept(server)
  }, [server, normalize, accept])

  return { draft, setDraft, baseline, accept, dirty: !sameTemplateValue(normalize(draft), normalize(baseline)) }
}
