import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

const limits = vi.hoisted(() => ({ cards: [] as { card: string; units: Record<string, string[]>; groups: unknown[] }[] }))
vi.mock("next/navigation", () => ({ usePathname: () => "/settings/tasks" }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))
vi.mock("@/api/imageRegistry/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/imageRegistry/settings")>()),
  getImageRegistrySettings: () => Promise.resolve({ Configured: false }),
}))
vi.mock("@/components/settings/ImageRegistryCard", () => ({ ImageRegistryCard: () => <section><h2>Реєстр образів</h2></section> }))
vi.mock("@/components/settings/PreviewDefaultsEditor", () => ({ PreviewDefaultsEditor: () => <section><h2>Тестові завдання заходів за замовчуванням</h2></section> }))
vi.mock("@/components/settings/LimitSettingsCard", () => ({
  LimitSettingsCard: (props: { card: string; title: string; units: Record<string, string[]>; groups: unknown[] }) => {
    limits.cards.push(props)
    return <section><h2>{props.title}</h2></section>
  },
}))

import Page from "./page"

describe("settings tasks page", () => {
  beforeEach(() => { limits.cards = [] })

  it("shows the four cards in order", async () => {
    render(<Page />)
    await screen.findByText("Реєстр образів", { selector: "h2" })
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Завдання")
    const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)
    expect(titles).toEqual(["Реєстр образів", "Ліміти архівів", "Тестові запуски", "Тестові завдання заходів за замовчуванням"])
  })

  it("passes the units of each limit card", async () => {
    render(<Page />)
    await waitFor(() => expect(limits.cards).toHaveLength(2))
    const [archive, runs] = limits.cards
    expect(archive.card).toBe("archive-limits")
    expect(archive.units).toEqual({ ArchiveBytes: ["MiB", "GiB"], EntryBytes: ["MiB", "GiB"], UnpackedBytes: ["MiB", "GiB"], Entries: [] })
    expect(runs.card).toBe("test-runs")
    expect(runs.units).toEqual({ Lease: ["hours", "days"], LeaseMax: ["hours", "days"] })
  })
})
