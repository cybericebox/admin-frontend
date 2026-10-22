import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { forgetHeldBanners, SiteBanner, SiteBannerBar } from "./SiteBanner"

const api = vi.hoisted(() => ({ fetch: vi.fn(), dismiss: vi.fn() }))
const pulse = vi.hoisted(() => ({ listeners: new Set<(value: unknown) => void>(), initial: "1" }))
vi.mock("@/api/notifications/banners", () => ({ fetchSiteBanners: api.fetch, dismissPersonalBanner: api.dismiss }))
vi.mock("@/lib/pulse", () => ({
  getPulseLoop: () => ({
    subscribe: (listener: (value: unknown) => void) => { pulse.listeners.add(listener); queueMicrotask(() => listener({ Banners: pulse.initial, Inbox: null })); return () => pulse.listeners.delete(listener) },
    pulseNow: vi.fn(),
  }),
}))

const critical = { ID: "b1", Kind: "site", Text: "Планові роботи", LinkURL: "/status", LinkLabel: "Деталі", Level: "critical", Dismissible: true, Version: "v1" }
const info = { ID: "b2", Kind: "site", Text: "Нова функція", LinkURL: "", LinkLabel: "", Level: "info", Dismissible: false, Version: "v1" }

describe("site banner bar", () => {
  beforeEach(() => {
    api.fetch.mockReset()
    api.dismiss.mockReset()
    api.dismiss.mockResolvedValue(undefined)
    pulse.listeners.clear()
    pulse.initial = "1"
    forgetHeldBanners()
    window.localStorage.clear()
    api.fetch.mockResolvedValue([critical, info])
  })

  it("shows only the primary banner until the remaining announcements are opened", async () => {
    render(<SiteBannerBar />)
    expect(await screen.findByText("Планові роботи")).toBeInTheDocument()
    expect(screen.getAllByRole("status")[0]).toHaveAttribute("data-level", "critical")
    expect(screen.getByRole("link", { name: "Деталі" })).toHaveAttribute("href", "/status")
    expect(screen.queryByText("Нова функція")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ще 1 оголошення" }))
    expect(await screen.findByRole("dialog", { name: "Інші оголошення" })).toBeInTheDocument()
    expect(screen.getByText("Нова функція")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("heading", { name: "Інші оголошення" })).toHaveFocus())
  })

  it("dismisses only the chosen banner by id and version, keeping the other banner visible", async () => {
    render(<SiteBannerBar />)
    await screen.findByText("Планові роботи")
    fireEvent.click(screen.getByRole("button", { name: "Закрити банер" }))
    expect(window.localStorage.getItem("cib_site_banner_dismissed_b1_v1")).toBe("1")
    expect(await screen.findByText("Нова функція")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Закрити банер" })).not.toBeInTheDocument()
  })

  it("keeps a dismissed banner hidden after a reload", async () => {
    window.localStorage.setItem("cib_site_banner_dismissed_b1_v1", "1")
    render(<SiteBannerBar />)
    expect(await screen.findByText("Нова функція")).toBeInTheDocument()
    expect(screen.queryByText("Планові роботи")).not.toBeInTheDocument()
  })

  it("shows the banner again when its version changes", async () => {
    window.localStorage.setItem("cib_site_banner_dismissed_b1_v1", "1")
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

  it("loads the list once and again only when the pulse reports a new banners version", async () => {
    render(<SiteBannerBar />)
    await screen.findByText("Планові роботи")
    expect(api.fetch).toHaveBeenCalledTimes(1)
    act(() => pulse.listeners.forEach((listener) => listener({ Banners: "1", Inbox: null })))
    await act(async () => { await Promise.resolve() })
    expect(api.fetch).toHaveBeenCalledTimes(1)
    api.fetch.mockResolvedValue([info])
    act(() => pulse.listeners.forEach((listener) => listener({ Banners: "2", Inbox: null })))
    expect(await screen.findByText("Нова функція")).toBeInTheDocument()
    expect(api.fetch).toHaveBeenCalledTimes(2)
  })

  it("never asks for the list on a page load without banners", async () => {
    pulse.initial = "e3b0c44298fc1c14"
    const { container } = render(<SiteBannerBar />)
    await act(async () => { await Promise.resolve() })
    act(() => pulse.listeners.forEach((listener) => listener({ Banners: "", Inbox: null })))
    expect(api.fetch).not.toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })

  it("clears the list without a request when the pulse reports that no banners are left", async () => {
    const { container } = render(<SiteBannerBar />)
    await screen.findByText("Планові роботи")
    act(() => pulse.listeners.forEach((listener) => listener({ Banners: "e3b0c44298fc1c14", Inbox: null })))
    await waitFor(() => expect(container).toBeEmptyDOMElement())
    expect(api.fetch).toHaveBeenCalledTimes(1)
  })

  it("a remount with the version already held shows the list without a request", async () => {
    const first = render(<SiteBannerBar />)
    await screen.findByText("Планові роботи")
    first.unmount()
    render(<SiteBannerBar />)
    expect(screen.getByText("Планові роботи")).toBeInTheDocument()
    await act(async () => { await Promise.resolve() })
    expect(api.fetch).toHaveBeenCalledTimes(1)
  })

  it("retries a failed load on the next pulse even with the same version", async () => {
    api.fetch.mockRejectedValueOnce(new Error("down"))
    render(<SiteBannerBar />)
    await waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(1))
    act(() => pulse.listeners.forEach((listener) => listener({ Banners: "1", Inbox: null })))
    expect(await screen.findByText("Планові роботи")).toBeInTheDocument()
    expect(api.fetch).toHaveBeenCalledTimes(2)
  })

  it("dismisses a personal banner on the server, not in local storage", async () => {
    api.fetch.mockResolvedValue([{ ...critical, ID: "p1", Kind: "personal" }])
    render(<SiteBannerBar />)
    await screen.findByText("Планові роботи")
    fireEvent.click(screen.getByRole("button", { name: "Закрити банер" }))
    expect(api.dismiss).toHaveBeenCalledWith("p1")
    expect(window.localStorage.getItem("cib_site_banner_dismissed_p1_v1")).toBeNull()
    await waitFor(() => expect(screen.queryByText("Планові роботи")).not.toBeInTheDocument())
  })

  it("never renders an unsafe link", () => {
    render(<SiteBanner banner={{ Text: "Текст", LinkURL: "javascript:alert(1)", LinkLabel: "Тут", Level: "info", Dismissible: false }} />)
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
  it("keeps ten banners behind a bounded disclosure and dismisses only the chosen remaining banner", async () => {
    api.fetch.mockResolvedValue(Array.from({ length: 10 }, (_, index) => ({ ...critical, ID: `b${index}`, Text: `Оголошення ${index + 1}` })))
    render(<SiteBannerBar />)
    expect(await screen.findByText("Оголошення 1")).toBeInTheDocument()
    expect(screen.getAllByRole("status")).toHaveLength(1)
    const more = screen.getByRole("button", { name: "Ще 9 оголошень" })
    fireEvent.click(more)
    const panel = await screen.findByRole("dialog", { name: "Інші оголошення" })
    expect(within(panel).queryByText("Оголошення 1")).not.toBeInTheDocument()
    expect(within(panel).getAllByRole("status")).toHaveLength(9)
    fireEvent.click(within(panel).getAllByRole("button", { name: "Закрити банер" })[0])
    expect(screen.queryByText("Оголошення 2")).not.toBeInTheDocument()
    expect(screen.getByText("Оголошення 1")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ще 8 оголошень" })).toBeInTheDocument()
    fireEvent.keyDown(panel, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(more).toHaveFocus())
    expect(screen.getAllByRole("status")).toHaveLength(1)
  })

  it("promotes the next primary and removes the extra action after the last remaining banner", async () => {
    api.fetch.mockResolvedValue([critical, { ...critical, ID: "b3", Text: "Друге" }, info])
    render(<SiteBannerBar />)
    await screen.findByText("Планові роботи")
    expect(screen.getByRole("button", { name: "Ще 2 оголошення" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Закрити банер" }))
    expect(screen.getByText("Друге")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ще 1 оголошення" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Закрити банер" }))
    expect(screen.getByText("Нова функція")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

})
