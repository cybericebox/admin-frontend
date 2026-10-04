import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { FunnelCards } from "./FunnelCards"
import { formatFunnelDuration } from "./funnel"
import type { MailFunnels } from "./types"

const funnels: MailFunnels = {
  Invitations: { Sent: 40, Accepted: 30, AcceptRate: 0.75, MedianAcceptSeconds: 3 * 3600 + 20 * 60 },
  Registration: { Started: 100, Completed: 80, CompletionRate: 0.8 },
  Applications: { Submitted: 20, Decided: 10, Approved: 6, Rejected: 4, DecidedRate: 0.5, ApprovedRate: 0.6, RejectedRate: 0.4, MedianDecisionSeconds: 2 * 86400 + 4 * 3600 },
}

describe("formatFunnelDuration", () => {
  it("formats humanely", () => {
    expect(formatFunnelDuration(45)).toBe("45 с")
    expect(formatFunnelDuration(12 * 60)).toBe("12 хв")
    expect(formatFunnelDuration(3 * 3600 + 20 * 60)).toBe("3 год 20 хв")
    expect(formatFunnelDuration(3 * 3600)).toBe("3 год")
    expect(formatFunnelDuration(2 * 86400 + 4 * 3600)).toBe("2 д 4 год")
    expect(formatFunnelDuration(null)).toBe("—")
  })
})

describe("FunnelCards", () => {
  it("shows numbers, percents and medians", () => {
    render(<FunnelCards funnels={funnels} loading={false} failed={false} />)
    const inv = within(screen.getByTestId("funnel-invitations"))
    expect(inv.getByText("40")).toBeInTheDocument()
    expect(inv.getByText("30")).toBeInTheDocument()
    expect(inv.getByText("75%")).toBeInTheDocument()
    expect(inv.getByText("3 год 20 хв")).toBeInTheDocument()
    expect(within(screen.getByTestId("funnel-registration")).getByText("80%")).toBeInTheDocument()
    const app = within(screen.getByTestId("funnel-applications"))
    expect(app.getByText("60%")).toBeInTheDocument()
    expect(app.getByText("40%")).toBeInTheDocument()
    expect(app.getByText("2 д 4 год")).toBeInTheDocument()
  })

  it("shows a dash for null rates and medians", () => {
    const nulls: MailFunnels = {
      Invitations: { Sent: 0, Accepted: 0, AcceptRate: null, MedianAcceptSeconds: null },
      Registration: { Started: 0, Completed: 0, CompletionRate: null },
      Applications: { Submitted: 0, Decided: 0, Approved: 0, Rejected: 0, DecidedRate: null, ApprovedRate: null, RejectedRate: null, MedianDecisionSeconds: null },
    }
    render(<FunnelCards funnels={nulls} loading={false} failed={false} />)
    expect(within(screen.getByTestId("funnel-invitations")).getAllByText("—")).toHaveLength(2)
    expect(within(screen.getByTestId("funnel-registration")).getAllByText("—")).toHaveLength(1)
    expect(within(screen.getByTestId("funnel-applications")).getAllByText("—")).toHaveLength(4)
  })

  it("has a source tooltip trigger per card and dashes without data", () => {
    render(<FunnelCards funnels={undefined} loading={false} failed />)
    expect(within(screen.getByTestId("funnel-invitations")).getAllByText("—").length).toBeGreaterThanOrEqual(4)
    expect(within(screen.getByTestId("mail-funnels")).getAllByRole("button")).toHaveLength(3)
  })
})
