import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useSavedDraft } from "./useSavedDraft"

const normalize = (draft: { name: string; count: string }) => ({ name: draft.name.trim(), count: Number(draft.count) })

describe("acknowledged form drafts", () => {
  it("ignores equivalent input and becomes clean again after reverting", () => {
    const { result } = renderHook(() => useSavedDraft({ name: "Saved", count: "1" }, normalize))
    expect(result.current.dirty).toBe(false)
    act(() => result.current.setDraft({ name: " Saved ", count: "1.0" }))
    expect(result.current.dirty).toBe(false)
    act(() => result.current.setDraft({ name: "Changed", count: "1" }))
    expect(result.current.dirty).toBe(true)
    act(() => result.current.setDraft({ name: "Saved", count: "1" }))
    expect(result.current.dirty).toBe(false)
  })

  it("acknowledges a completed save without discarding newer edits", () => {
    const { result } = renderHook(() => useSavedDraft({ name: "Saved", count: "1" }, normalize))
    act(() => result.current.setDraft({ name: "First", count: "2" }))
    const submitted = { name: "First", count: 2 }
    act(() => result.current.setDraft({ name: "Newer", count: "3" }))
    act(() => { expect(result.current.accept({ name: "First", count: "2" }, submitted)).toBe(false) })
    expect(result.current.draft).toEqual({ name: "Newer", count: "3" })
    expect(result.current.dirty).toBe(true)
    act(() => { expect(result.current.accept({ name: "Newer", count: "3" }, { name: "Newer", count: 3 })).toBe(true) })
    expect(result.current.dirty).toBe(false)
  })

  it("follows server refreshes when clean and retains drafts when dirty", () => {
    const { result, rerender } = renderHook(({ server }) => useSavedDraft(server, normalize), { initialProps: { server: { name: "Saved", count: "1" } } })
    rerender({ server: { name: "Refreshed", count: "2" } })
    expect(result.current.draft.name).toBe("Refreshed")
    act(() => result.current.setDraft({ name: "Mine", count: "2" }))
    rerender({ server: { name: "Other", count: "2" } })
    expect(result.current.draft.name).toBe("Mine")
    act(() => result.current.setDraft({ name: "Other", count: "2" }))
    expect(result.current.dirty).toBe(false)
  })
})
