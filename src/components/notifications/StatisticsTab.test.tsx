import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("@/api/client", () => ({ apiGet: vi.fn() }))

import { apiGet } from "@/api/client"
import { StatisticsTab } from "./StatisticsTab"

const stats = (total: number) => ({
  Since: "2026-09-01T00:00:00Z", Total: total, ByStatus: [], ByType: [], ByChannel: [],
})

describe("StatisticsTab", () => {
  beforeEach(() => {
    vi.mocked(apiGet).mockReset()
    vi.mocked(apiGet).mockImplementation((path: string) =>
      Promise.resolve(stats(path.includes("days=7") ? 7 : 30)))
  })

  it("loads the selected statistics window", async () => {
    render(<StatisticsTab />)
    await waitFor(() => expect(screen.getByText("30")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "7" }))
    await waitFor(() => expect(screen.getByText("7", { selector: "p" })).toBeInTheDocument())
    expect(apiGet).toHaveBeenCalledWith("/api/notifications/stats?days=7")
  })
})
