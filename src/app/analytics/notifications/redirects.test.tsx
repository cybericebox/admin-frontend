import { describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"
import MailPage from "../mail/page"
import StatsPage from "../../notifications/stats/page"

const replace = vi.hoisted(() => vi.fn())
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }))

describe("moved analytics pages", () => {
  it("send the old «Пошта» and notification statistics URLs to the merged page", () => {
    render(<MailPage />)
    render(<StatsPage />)
    expect(replace).toHaveBeenCalledTimes(2)
    expect(replace).toHaveBeenNthCalledWith(1, "/analytics/notifications")
    expect(replace).toHaveBeenNthCalledWith(2, "/analytics/notifications")
  })
})
