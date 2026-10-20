// @vitest-environment jsdom
import {act, StrictMode} from "react"
import {createRoot} from "react-dom/client"
import {afterEach, expect, it, vi} from "vitest"
import ErrorPage from "./error"
import GlobalError from "./global-error"

vi.mock("geist/font/sans", () => ({GeistSans: {variable: "font-sans"}}))
vi.mock("geist/font/mono", () => ({GeistMono: {variable: "font-mono"}}))
vi.mock("next/navigation", () => ({usePathname: () => "/"}))
const recovery = vi.hoisted(() => ({recover: vi.fn(() => false), retry: vi.fn((_error: unknown, fallback: () => void) => fallback())}))
vi.mock("@/lib/chunkRecovery", () => ({installChunkRecovery: () => recovery}))
;(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {vi.restoreAllMocks(); recovery.recover.mockClear(); recovery.retry.mockClear()})

it.each(["segment", "global"] as const)("keeps the shared %s error screen and manual retry after guarded recovery", async kind => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  const error = Object.assign(new Error("Loading chunk 42 failed."), {name: "ChunkLoadError"})
  document.cookie = "cib_theme=light; path=/"
  const retry = vi.fn()
  const host = document.createElement("div")
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    const Screen = kind === "global" ? GlobalError : ErrorPage
    await act(async () => {root.render(<StrictMode><Screen error={error} retry={retry} /></StrictMode>)})
    expect(recovery.recover).toHaveBeenCalledWith(error)
    expect(document.documentElement.textContent).toContain("Не вдалося завантажити сторінку")
    const button = [...document.querySelectorAll("button")].find(b => b.textContent === "Спробувати ще раз")!
    expect(button).toBeTruthy()
    await act(async () => button.click())
    expect(recovery.retry).toHaveBeenCalledWith(error, retry)
    expect(retry).toHaveBeenCalledTimes(1)
    expect(document.documentElement.textContent).not.toContain("Loading chunk 42 failed.")
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
