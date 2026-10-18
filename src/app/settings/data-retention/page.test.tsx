import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

const seen = vi.hoisted(() => ({ props: null as null | { card: string; units: Record<string, string[]>; groups: { titleKey: string; keys: string[] }[]; title: string } }))
vi.mock("next/navigation", () => ({ usePathname: () => "/settings/data-retention" }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))
vi.mock("@/components/settings/LimitSettingsCard", () => ({
  LimitSettingsCard: (props: NonNullable<typeof seen.props>) => { seen.props = props; return <section><h2>{props.title}</h2></section> },
}))

import Page from "./page"

describe("data retention page", () => {
  it("renders one retention card with the groups in the binding order", () => {
    render(<Page />)
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Зберігання даних")
    const props = seen.props!
    expect(props.card).toBe("retention")
    expect(props.groups.map((g) => g.titleKey)).toEqual(["accounts", "sessions", "mail", "events", "files"].map((n) => `admin.limits.group.${n}`))
    expect(props.groups.map((g) => g.keys)).toEqual([
      ["PendingAccount", "InactiveAccount", "InactivityGrace", "ExpiredInvitation"],
      ["SessionAfterExpiry"],
      ["DeliveryLog", "SignalHistory"],
      ["FormAnswersAfterEventEnd", "EventAnalyticsAfterEnd", "LabTelemetry"],
      ["UnusedAnswerFile"],
    ])
  })

  it("uses days and years, and hours and days for the unused answer file", () => {
    render(<Page />)
    const units = seen.props!.units
    expect(units.PendingAccount).toEqual(["days", "years"])
    expect(units.LabTelemetry).toEqual(["days", "years"])
    expect(units.UnusedAnswerFile).toEqual(["hours", "days"])
    expect(Object.keys(units)).toHaveLength(11)
  })
})
