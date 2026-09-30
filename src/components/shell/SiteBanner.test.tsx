import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SiteBanner, SiteBannerBar } from "./SiteBanner"

const api = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock("@/api/notifications/banners", () => ({ fetchSiteBanners: api.fetch }))

const critical = { ID: "b1", Text: "Планові роботи", LinkURL: "/status", LinkLabel: "Деталі", Level: "critical", Dismissible: true, Version: "v1" }
const info = { ID: "b2", Text: "Нова функція", LinkURL: "", LinkLabel: "", Level: "info", Dismissible: false, Version: "v1" }

describe("site banner bar", () => {
  beforeEach(() => {
    api.fetch.mockReset()
    window.localStorage.clear()
    api.fetch.mockResolvedValue([critical, info])
  })

  it("shows the most severe banner with its link and level", async () => {
    render(<SiteBannerBar />)
    expect(await screen.findByText("Планові роботи")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveAttribute("data-level", "critical")
    expect(screen.getByRole("link", { name: "Деталі" })).toHaveAttribute("href", "/status")
    expect(screen.queryByText("Нова функція")).not.toBeInTheDocument()
  })

  it("remembers a dismissal by id and version, then shows the next banner", async () => {
    render(<SiteBannerBar />)
    await screen.findByText("Планові роботи")
    fireEvent.click(screen.getByRole("button", { name: "Закрити банер" }))
    expect(window.localStorage.getItem("ib:banner:b1:v1")).toBe("1")
    expect(await screen.findByText("Нова функція")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Закрити банер" })).not.toBeInTheDocument()
  })

  it("keeps a dismissed banner hidden after a reload", async () => {
    window.localStorage.setItem("ib:banner:b1:v1", "1")
    render(<SiteBannerBar />)
    expect(await screen.findByText("Нова функція")).toBeInTheDocument()
    expect(screen.queryByText("Планові роботи")).not.toBeInTheDocument()
  })

  it("shows the banner again when its version changes", async () => {
    window.localStorage.setItem("ib:banner:b1:v1", "1")
    api.fetch.mockResolvedValue([{ ...critical, Version: "v2" }])
    render(<SiteBannerBar />)
    expect(await screen.findByText("Планові роботи")).toBeInTheDocument()
  })

  it("survives unavailable storage and a failing endpoint", async () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked") })
    render(<SiteBannerBar />)
    expect(await screen.findByText("Планові роботи")).toBeInTheDocument()
    spy.mockRestore()
  })

  it("renders nothing when the endpoint fails", async () => {
    api.fetch.mockRejectedValue(new Error("down"))
    const { container } = render(<SiteBannerBar />)
    await waitFor(() => expect(api.fetch).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it("polls every minute", async () => {
    vi.useFakeTimers()
    try {
      render(<SiteBannerBar />)
      await act(async () => { await Promise.resolve() })
      expect(api.fetch).toHaveBeenCalledTimes(1)
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
      expect(api.fetch).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it("never renders an unsafe link", () => {
    render(<SiteBanner banner={{ Text: "Текст", LinkURL: "javascript:alert(1)", LinkLabel: "Тут", Level: "info", Dismissible: false }} />)
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
})
